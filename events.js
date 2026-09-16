// hud-manager/events.js
//
// Домен «События»: глобальные обработчики UI, MutationObserver за контейнером
// чата и подписка на жизненный цикл SillyTavern.
//
// Обработчики дёргают функции и состояние, оставшиеся в index.js. Они
// передаются одним объектом ctx при инициализации. Изменяемое состояние
// передаётся геттерами, а не значениями:
//   getChatContainer()       — cachedChatContainer переприсваивается в initApp;
//   getPerformanceObserver() — IntersectionObserver создаётся и сбрасывается
//                              perf-кластером в index.js по мере смены режима.
// Всё остальное (settings, функции) — стабильные ссылки.

import { invalidateAvatarCache } from './avatars.js?v=22.99.70';
import { applyRelGraphFocus, setRelGraphExpandedState } from './render/relations-graph.js?v=22.99.70';
import { openPhoneMediaViewer } from './render/phone.js?v=22.99.70';
import { getTheme, themeVars, presetRowHTML, THEME_KEYS , themeSnapshot, parseThemeFile } from './themes.js?v=22.99.70';
import { settings, defaultSettings } from './settings.js?v=22.99.70';
import { getWorldVotes } from './render/world.js?v=22.99.70';

// Приватен для модуля: initObserver — единственное место создания.
let observer = null;

// Накопитель между срабатываниями наблюдателя. Пока модель печатает ответ,
// characterData-мутации идут десятками в секунду, и раньше на каждый кадр
// уходил полный разбор сообщения — результат тот же, работа настоящая.
// Копим задетые сообщения и разбираем их пачкой: после короткой тишины, но
// не реже потолка, иначе во время непрерывного стрима разбор не случится
// вообще и карточка не появится, пока модель не замолчит.
const ЖДУЩИЕ = new Set();
let разборТаймер = 0;
let разборНачат = 0;
let аватаркиМенялись = false;
const РАЗБОР_ТИШИНА = 120;
const РАЗБОР_ПОТОЛОК = 600;

function отменитьРазбор() {
  if (разборТаймер) { clearTimeout(разборТаймер); разборТаймер = 0; }
  разборНачат = 0;
  ЖДУЩИЕ.clear();
  аватаркиМенялись = false;
}

/* ---------------------------------------------------------------------
   МИНИ-ГАЙД: РАЗВОРОТ ПОДСКАЗКИ
   ---------------------------------------------------------------------
   Подсказка вкладки живёт в готовом месте под полосой вкладок, подсказка
   поля создаётся рядом со строкой, к которой относится. Разворот плавный:
   у обёртки меняется grid-template-rows с 0fr на 1fr, и высота не нужна
   заранее — браузер считает её сам. */
function подсказкаДляЗначка(значок, ctx) {
  const вид = значок.getAttribute('data-tab-help');
  if (вид) return { ключ: 'tab:' + вид, статья: ctx.tabHelp && ctx.tabHelp[вид] };
  const поле = значок.getAttribute('data-term-help');
  if (поле && ctx.findTermHelp) {
    // Заголовок берём с самой подписи, а не из ключа: там он уже в нужном
    // виде, со значком и заглавной буквой.
    // Сам знак нарисован псевдоэлементом, в textContent его нет — чистить
    // подпись не от чего.
    const подпись = значок.parentElement;
    const текст = подпись ? подпись.textContent : поле;
    return { ключ: 'term:' + поле, статья: ctx.findTermHelp(текст) };
  }
  return { ключ: '', статья: null };
}

// Куда положить подсказку. У вкладки — готовая полоса под полосой вкладок.
// У поля — сразу после строки, в которой это поле сидит.
function местоПодсказки(значок) {
  if (значок.hasAttribute('data-tab-help')) {
    const обёртка = значок.closest('.hud-os-wrapper');
    return обёртка && обёртка.querySelector('.hud-tab-hint');
  }
  const строка = значок.closest('.hud-row, .hud-key-block, .hud-world-section, .hud-memory-secret')
    || значок.parentElement;
  if (!строка || !строка.parentElement) return null;
  let место = строка.nextElementSibling;
  if (!место || !место.classList.contains('hud-hint')) {
    место = document.createElement('div');
    место.className = 'hud-hint';
    место.hidden = true;
    строка.parentElement.insertBefore(место, строка.nextSibling);
  }
  return место;
}

// Плавность держится на замере: max-height нельзя анимировать от нуля до
// auto, поэтому высоту содержимого считаем сами. После разворота ставим
// none, чтобы подсказка могла подрасти, если вёрстка вокруг изменится.
// Показать развёрнутую подсказку целиком, подкрутив ближайший
// прокручиваемый контейнер. Страницу и ленту чата не трогаем: их
// самовольный сдвиг увёл бы карточку из-под пальца.
function показатьЦеликом(место) {
  let узел = место.parentElement;
  while (узел && узел !== document.body) {
    const s = getComputedStyle(узел);
    if (/(auto|scroll)/.test(s.overflowY) && узел.scrollHeight > узел.clientHeight + 1) {
      const rк = узел.getBoundingClientRect();
      const rп = место.getBoundingClientRect();
      const ниже = rп.bottom - rк.bottom;
      const выше = rк.top - rп.top;
      // Вниз крутим не дальше, чем до верхней кромки подсказки: иначе её
      // начало уедет вверх за край, и читать придётся с середины.
      if (ниже > 0) узел.scrollTop += Math.min(ниже + 8, Math.max(0, rп.top - rк.top));
      else if (выше > 0) узел.scrollTop -= выше + 8;
      return;
    }
    узел = узел.parentElement;
  }
}

function развернуть(место) {
  место.hidden = false;
  место.style.maxHeight = '0px';
  // Принудительный пересчёт вёрстки: браузер обязан заметить нулевую
  // высоту как начальную, иначе переход стартует уже из открытого
  // состояния. Раньше для этого ждали кадр, но кадра можно и не
  // дождаться — чтение offsetHeight делает то же самое и сразу.
  void место.offsetHeight;
  место.style.maxHeight = место.scrollHeight + 'px';
  место.classList.add('is-open');
  // После разворота снимаем потолок, чтобы подсказка могла подрасти,
  // если вёрстка вокруг изменится, и показываем её целиком.
  setTimeout(() => {
    if (!место.classList.contains('is-open')) return;
    место.style.maxHeight = 'none';
    показатьЦеликом(место);
  }, 260);
}

function закрытьПодсказку(место) {
  if (!место) return;
  if (!место.classList.contains('is-open')) { место.hidden = true; return; }
  // От none анимировать нечего: сначала возвращаем измеримую высоту и
  // даём браузеру её зафиксировать.
  место.style.maxHeight = место.scrollHeight + 'px';
  void место.offsetHeight;
  место.classList.remove('is-open');
  место.style.maxHeight = '0px';
  // Прячем не сразу: пусть доиграет схлопывание, иначе рывок вернётся,
  // только в обратную сторону.
  setTimeout(() => { if (!место.classList.contains('is-open')) место.hidden = true; }, 260);
}

function переключитьПодсказку(значок, ctx) {
  const { ключ, статья } = подсказкаДляЗначка(значок, ctx);
  if (!статья) return;
  const место = местоПодсказки(значок);
  if (!место) return;
  const карточка = значок.closest('.hud-os-card') || document;

  // Повторное нажатие по тому же вопросику закрывает подсказку.
  if (место.classList.contains('is-open') && место.dataset.helpKey === ключ) {
    закрытьПодсказку(место);
    значок.classList.remove('is-open');
    return;
  }

  // Открыта может быть только одна: две подсказки сразу читаются как сбой.
  карточка.querySelectorAll('.hud-hint.is-open, .hud-tab-hint.is-open').forEach(п => {
    if (п !== место) закрытьПодсказку(п);
  });
  карточка.querySelectorAll('.hud-help-mark.is-open').forEach(з => з.classList.remove('is-open'));

  место.dataset.helpKey = ключ;
  место.innerHTML = ctx.buildHintHTML(статья);
  развернуть(место);
  значок.classList.add('is-open');
}

export function initGlobalEvents(ctx) {
  // settings и getWorldVotes раньше брались из ctx, но index.js их туда не
  // клал: обе ссылки молча оставались undefined. Внутри обработчика клика
  // (он async) исключение превращалось в проглоченный отказ промиса — ни
  // ошибки в консоли, ни реакции на нажатие. Из-за этого не работали разом
  // выбор темы, ВСЕ ползунки кастомизации, загрузка фона и голосование за
  // новости. settings по своей природе общий живой объект (см. settings.js),
  // а getWorldVotes живёт в домене «Мир» — берём их импортом, а не через ctx.
  const { saveSettings, applyThemeColors, showHudToast } = ctx;

  // Наборы тем. Панель живёт внутри карточки HUD, а карточки появляются,
  // сворачиваются и пересобираются — привязываться к самим полям бессмысленно,
  // слушаем документ. И только отсюда: saveSettings приходит с ctx.
  document.addEventListener('change', (e) => {
    const box = e.target && e.target.closest && e.target.closest('[data-theme-pack]');
    if (!box) return;
    if (!settings.themePacks || typeof settings.themePacks !== 'object') settings.themePacks = {};
    settings.themePacks[box.dataset.themePack] = box.checked;
    saveSettings();
    // Перерисовываем только ряд пресетов: панель целиком трогать нельзя, иначе
    // схлопнутся открытые вкладки настроек.
    document.querySelectorAll('.hud-theme-presets-row').forEach(row => {
      row.innerHTML = presetRowHTML(settings.themePreset);
    });
  });
  if (window.hudEventsInitialized) return;
  window.hudEventsInitialized = true;
  // Облегчённая карточка пропускала правки темы, пока лежала вне документа:
  // после возврата подтягиваем её поля к текущим настройкам.
  синхронизацияТемы = () => {
    syncThemeInputs();
    redrawPresets();
    document.querySelectorAll('[data-theme-pack]').forEach(box => {
      box.checked = !(settings.themePacks && settings.themePacks[box.dataset.themePack] === false);
    });
  };

  document.body.addEventListener('change', function(e) {
    const toggle = e.target.closest('.hud-toggle-input');
    if (!toggle) return;
    const card = toggle.closest('.hud-os-card');
    if (!card) return;
    if (toggle.checked) card.dataset.userExpanded = 'true';
    else delete card.dataset.userExpanded;
  });

  document.addEventListener('click', async function(e) {
    // === НАЖАТИЕ НА КНОПКУ ПАПКИ ===
    const uploadBtn = e.target.closest('.hud-bg-upload-btn');
    if (uploadBtn) {
      e.preventDefault();
      e.stopPropagation();
      const fileInput = uploadBtn.nextElementSibling;
      if (fileInput && fileInput.classList.contains('hud-bg-upload-file')) {
          // Привязываем загрузку
          fileInput.onchange = (ev) => {
              const file = ev.target.files[0];
              if (!file) return;
              if (file.size > 3 * 1024 * 1024) {
                  showHudToast('error', 'Слишком большой файл', 'Выберите картинку до 3 МБ.');
                  return;
              }
              const reader = new FileReader();
              reader.onload = (readEv) => {
                  settings.bgImage = readEv.target.result;
                  saveSettings();
                  applyThemeColors();
                  // Красиво пишем во всех карточках, что файл локальный
                  document.querySelectorAll('.hud-theme-text-input[data-key="bgImage"]').forEach(inp => inp.value = '(Локальный файл)');
                  showHudToast('success', 'Фон загружен', 'Картинка успешно установлена!');
              };
              reader.readAsDataURL(file);
          };
          fileInput.click(); // Имитируем клик по скрытому инпуту
      }
      return;
    }

    // Убрать фон: то же, что стереть ссылку руками, только одним нажатием.
    const bgClear = e.target.closest('.hud-bg-clear-btn');
    if (bgClear) {
      e.preventDefault();
      e.stopPropagation();
      settings.bgImage = '';
      saveSettings();
      applyThemeColors();
      document.querySelectorAll('.hud-theme-text-input[data-key="bgImage"]').forEach(inp => { inp.value = ''; });
      showHudToast('success', 'Фон убран', 'Картинка карточки отключена.');
      return;
    }


    const themeBtn = e.target.closest('.hud-theme-btn');
    if (themeBtn) {
      e.preventDefault();
      e.stopPropagation();
      const card = themeBtn.closest('.hud-os-card');
      const panel = card.querySelector('.hud-theme-panel');
      if (panel) panel.classList.toggle('active');
      return;
    }

    // Действия над темой: запомнить правки, вернуть исходное, сохранить
    // свою. Правки живут отдельно на каждую тему, поэтому подстройка
    // «Каваи» не перепишет подстройку «Vamp».
    const actBtn = e.target.closest('[data-theme-act]');
    if (actBtn) {
      e.preventDefault();
      e.stopPropagation();
      const act = actBtn.dataset.themeAct;
      // Обнулить цвет текста — вернуть наследование из темы SillyTavern.
      if (act === 'cleartext') {
        settings.textColor = ''; settings.textMutedColor = '';
        saveSettings(); applyThemeColors();
        showHudToast('success', 'Цвет текста сброшен', 'HUD снова берёт цвет из темы SillyTavern.');
        return;
      }
      const id = settings.themePreset || '';
      const snapshot = () => {
        const out = {};
        THEME_KEYS.forEach(k => { if (settings[k] !== undefined) out[k] = settings[k]; });
        return out;
      };

      if (act === 'save') {
        if (!id) { showHudToast('error', 'Тема не выбрана', 'Сначала выберите тему — правки запоминаются для неё.'); return; }
        // Храним только то, что реально отличается от самой темы: так
        // сохранённое остаётся правкой, а не полной копией.
        const base = (getTheme(id) || { vars: {} }).vars;
        const diff = {};
        THEME_KEYS.forEach(k => {
          if (settings[k] === undefined) return;
          if (String(settings[k]) !== String(base[k])) diff[k] = settings[k];
        });
        if (!settings.themeEdits || typeof settings.themeEdits !== 'object') settings.themeEdits = {};
        settings.themeEdits[id] = diff;
        saveSettings();
        showHudToast('success', 'Правки запомнены',
          Object.keys(diff).length + ' изменённых полей сохранено для этой темы.');
        return;
      }

      if (act === 'revert') {
        if (!id) { showHudToast('error', 'Тема не выбрана', 'Возвращать нечего.'); return; }
        if (settings.themeEdits) delete settings.themeEdits[id];
        THEME_KEYS.forEach(k => { if (defaultSettings[k] !== undefined) settings[k] = defaultSettings[k]; });
        const base = themeVars(id);
        if (base) Object.assign(settings, base);
        saveSettings(); applyThemeColors(); syncThemeInputs();
        showHudToast('success', 'Тема возвращена', 'Исходные значения на месте.');
        return;
      }

      if (act === 'mine') {
        settings.customTheme = { label: 'Своя', icon: '★', vars: snapshot() };
        settings.themePreset = 'custom';
        saveSettings(); applyThemeColors(); redrawPresets();
        showHudToast('success', 'Своя тема сохранена', 'Теперь она стоит в ряду рядом с готовыми.');
        return;
      }

      // Выгрузка темы файлом. Отдаём то, что сейчас выставлено ползунками, —
      // включая ручные правки поверх пресета: пересылают обычно именно их.
      if (act === 'export') {
        const выбранная = getTheme(id);
        const снимок = themeSnapshot(выбранная ? выбранная.label : 'Тема TavernOS');
        const blob = new Blob([JSON.stringify(снимок, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'tavernos-тема-' + (id || 'своя') + '.json';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        showHudToast('success', 'Тема сохранена в файл', 'Его можно переслать — он читаемый и правится руками.');
        return;
      }

      // Загрузка чужого файла. Разбор в themes.js берёт только знакомые поля:
      // тема не должна становиться способом положить в настройки что угодно.
      if (act === 'import') {
        const поле = document.createElement('input');
        поле.type = 'file';
        поле.accept = 'application/json,.json';
        поле.addEventListener('change', async () => {
          const файл = поле.files && поле.files[0];
          if (!файл) return;
          try {
            const тема = parseThemeFile(await файл.text());
            if (!тема) { showHudToast('error', 'Не похоже на тему', 'В файле не нашлось ни одного знакомого поля.'); return; }
            settings.customTheme = { label: тема.label, icon: тема.icon, vars: тема.vars };
            settings.themePreset = 'custom';
            if (settings.themeEdits) delete settings.themeEdits.custom;
            Object.assign(settings, тема.vars);
            saveSettings(); applyThemeColors(); redrawPresets(); syncThemeInputs();
            showHudToast('success', 'Тема загружена', тема.label + ' — ' + Object.keys(тема.vars).length + ' полей.');
          } catch (err) {
            console.error('[TavernOS HUD] Тема не прочиталась:', err);
            showHudToast('error', 'Файл не прочитался', 'Подробности в консоли.');
          }
        });
        поле.click();
        return;
      }

      if (act === 'forget') {
        settings.customTheme = null;
        if (settings.themeEdits) delete settings.themeEdits.custom;
        if (settings.themePreset === 'custom') settings.themePreset = '';
        saveSettings(); applyThemeColors(); redrawPresets();
        showHudToast('success', 'Своя тема удалена', 'Ряд тем вернулся к готовым.');
        return;
      }
      return;
    }

    // Готовая тема оформления. Тема не отдельный режим, а пресет: она
    // раскладывает значения по обычным настройкам, поэтому после неё любой
    // ползунок остаётся рабочим. Панель целиком не перерисовываем —
    // обновляем поля на месте, иначе открытые вкладки схлопнулись бы.
    const presetBtn = e.target.closest('.hud-theme-preset');
    if (presetBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = presetBtn.dataset.themePreset || '';
      const theme = getTheme(id);
      // Сначала возвращаем заводские значения всех ключей, которые вообще
      // трогают темы: иначе прошлая тема оставила бы после себя хвосты —
      // например, шрифт от «Киберпанка» в «Средневековье».
      THEME_KEYS.forEach(k => { if (defaultSettings[k] !== undefined) settings[k] = defaultSettings[k]; });
      // Значения темы вместе с правками пользователя поверх неё.
      if (theme) Object.assign(settings, themeVars(id));
      settings.themePreset = theme ? theme.id : '';
      saveSettings();
      applyThemeColors();

      syncThemeInputs();
      document.querySelectorAll('.hud-theme-preset').forEach(b => {
        b.classList.toggle('active', (b.dataset.themePreset || '') === settings.themePreset);
      });
      showHudToast('success', theme ? theme.label : 'Стандартная тема',
        theme ? theme.hint : 'Цвета вернулись к исходным.');
      return;
    }

    const newsVote = e.target.closest('.hud-news-vote');
    if (newsVote) {
      e.preventDefault();
      e.stopPropagation();
      const key = newsVote.getAttribute('data-vote-key');
      const kind = newsVote.getAttribute('data-vote-kind');
      if (!key) return;
      const state = getWorldVotes(key);
      const isUp = kind === 'up';
      if (isUp) {
        state.votedUp = !state.votedUp;
        state.up += state.votedUp ? 1 : -1;
        newsVote.classList.toggle('is-on', state.votedUp);
        newsVote.setAttribute('aria-pressed', String(state.votedUp));
      } else {
        state.votedC = !state.votedC;
        state.comments += state.votedC ? 1 : -1;
        newsVote.classList.toggle('is-on', state.votedC);
        newsVote.setAttribute('aria-pressed', String(state.votedC));
      }
      const n = newsVote.querySelector('.hud-news-vote-n');
      if (n) n.textContent = String(isUp ? state.up : state.comments);
      return;
    }

    const remember = e.target.closest('.hud-remember');
    if (remember) {
      e.preventDefault();
      e.stopPropagation();
      if (ctx.openLoreDialog) {
        ctx.openLoreDialog(remember.dataset.loreText || '', remember.dataset.loreKeys || '');
      }
      return;
    }

    // Вопросик: и у вкладки, и у поля. Стоит выше обработчика вкладок —
    // у вкладки он лежит внутри неё, и иначе нажатие переключало бы вкладку.
    const вопросик = e.target.closest('.hud-help-mark');
    if (вопросик) {
      e.preventDefault();
      e.stopPropagation();
      переключитьПодсказку(вопросик, ctx);
      return;
    }

    const tab = e.target.closest('.hud-tab');
    if (tab) {
      e.preventDefault();
      const parent = tab.closest('.hud-os-wrapper');
      parent.querySelectorAll('.hud-tab').forEach(t => t.classList.remove('active'));
      parent.querySelectorAll('.hud-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      // Отложенная вкладка собирается здесь — при первом открытии.
      let target = parent.querySelector(`#${tab.dataset.target}`);
      if (target && target.classList.contains('hud-tab-lazy') && ctx.renderLazyTab) {
        target = ctx.renderLazyTab(target);
        // Содержимое вкладки только что появилось: возвращаем пометки и
        // вопросики, которых в свежей разметке нет.
        refreshReactions(target);
        if (ctx.attachHelpMarks) ctx.attachHelpMarks(target);
      }
      if (target) target.classList.add('active');
      return;
    }

    const secretToggle = e.target.closest('[data-secret-toggle]');
    if (secretToggle) {
      const id = secretToggle.getAttribute('data-secret-toggle');
      const body = document.getElementById(id);
      if (body) {
        const open = !body.hidden;
        body.hidden = open;
        secretToggle.setAttribute('aria-expanded', String(!open));
        secretToggle.closest('.hud-memory-secret')?.classList.toggle('is-open', !open);
      }
      return;
    }

    // Контейнер мессенджера: в личном телефоне это экран приложения внутри
    // эмулятора, в перехватах — старый .hud-phone-mockup. Ищем ближайший,
    // чтобы переключение подвкладок работало в обоих.
    // Контейнер мессенджера: в личном телефоне это экран приложения внутри
    // эмулятора, в перехватах — старый .hud-phone-mockup. Ищем ближайший,
    // чтобы переключение подвкладок работало в обоих.
    const phoneScope = (el) => el.closest('.hud-phone-app-view, .hud-phone-mockup');

    // Экран «Сообщения» живёт в двух состояниях, и переключает их не класс
    // .active на теле переписки, а is-chat-open на самом экране: без него
    // .hud-phone-chat-stage остаётся display:none, и тап по чату выглядит
    // как «телефон не реагирует». Список и сцена переписки взаимно
    // исключают друг друга — см. правила у [data-phone-view="messages"].
    // Прочтение переписки. Эта часть жила в утраченных строках и не вернулась
    // вместе с остальным: рендерер до сих пор кладёт data-chat-target именно
    // ради неё (см. комментарий в render/phone.js), но снимать непрочитанное
    // было некому — счётчики и уведомления висели после захода в чат.
    const markChatRead = (view, body) => {
      const emulator = view.closest('.hud-phone-emulator') || view;
      const id = body && body.id;
      if (!id) return;
      // 1. Точки «не прочитано» у сообщений превращаются в двойную галочку.
      body.querySelectorAll('.msg-status.unread-dot').forEach(dot => {
        dot.classList.remove('unread-dot');
        dot.classList.add('read');
        dot.textContent = '✓✓';
      });
      // 2. Счётчик на строке чата в списке.
      const row = emulator.querySelector(`.hud-phone-chat-row[data-chat-target="${CSS.escape(id)}"]`);
      if (row) row.querySelectorAll('.hud-unread-badge').forEach(b => b.remove());
      // 3. Карточка уведомления этого чата уходит со стопки.
      emulator.querySelectorAll(`.hud-phone-notif[data-chat-target="${CSS.escape(id)}"]`).forEach(n => n.remove());
      // 4. Пересчитываем остаток: сумма счётчиков оставшихся строк списка.
      let left = 0;
      emulator.querySelectorAll('.hud-phone-chat-row .hud-unread-badge').forEach(b => {
        left += parseInt(b.textContent, 10) || 0;
      });
      const stack = emulator.querySelector('.hud-phone-notif-stack');
      if (stack) {
        const counter = stack.querySelector('.hud-phone-notif-count');
        if (counter) counter.textContent = String(left);
        // Стопка без карточек — пустая рамка, её быть не должно.
        if (!stack.querySelector('.hud-phone-notif') || left === 0) stack.remove();
        else stack.querySelector('.hud-phone-notif')?.classList.add('hud-phone-notif--first');
      }
      const appBadge = emulator.querySelector('.hud-phone-app[data-phone-app="messages"] .hud-unread-badge');
      if (appBadge) {
        if (left > 0) appBadge.textContent = String(left);
        else appBadge.remove();
      }
    };

    const openChat = (view, body) => {
      if (!view) return;
      view.querySelectorAll('.hud-phone-subbody.active').forEach(b => b.classList.remove('active'));
      if (body) {
        body.classList.add('active');
        view.classList.add('is-chat-open');
        markChatRead(view, body);
        // Пузыри этой переписки появились только сейчас: пометки, которые
        // человек ставил раньше, в разметке не хранятся.
        refreshReactions(body);
      } else {
        view.classList.remove('is-chat-open');
      }
    };

    // Вложение в переписке: снимок или ролик. Настоящего файла нет — по клику
    // показываем описание, которое написала модель.
    const media = e.target.closest('.hud-msg-media');
    if (media) {
      e.preventDefault();
      openPhoneMediaViewer(media);
      return;
    }

    const participantsToggle = e.target.closest('.hud-phone-title-group');
    if (participantsToggle && participantsToggle.querySelector('.hud-phone-participants-list')) {
      e.preventDefault();
      const list = participantsToggle.querySelector('.hud-phone-participants-list');
      const scope = phoneScope(participantsToggle);
      if (scope) {
        scope.querySelectorAll('.hud-phone-participants-list.active').forEach(el => {
          if (el !== list) el.classList.remove('active');
        });
      }
      list.classList.toggle('active');
      return;
    }

    // Стрелка «назад» в шапке переписки: сначала закрывает переписку и
    // возвращает к списку чатов, и только со списка сворачивает приложение
    // на домашний экран.
    const phoneBack = e.target.closest('.hud-phone-back');
    if (phoneBack) {
      e.preventDefault();
      const view = phoneBack.closest('.hud-phone-app-view');
      if (view && view.classList.contains('is-chat-open')) {
        openChat(view, null);
        return;
      }
      const backScope = view || phoneBack.closest('.hud-phone-mockup');
      const openBody = backScope && backScope.querySelector('.hud-phone-subbody.active');
      if (openBody) {
        openBody.classList.remove('active');
        return;
      }
      const emulator = phoneBack.closest('.hud-phone-emulator');
      if (emulator) emulator.querySelectorAll('.hud-phone-app-view.active').forEach(v => v.classList.remove('active'));
      return;
    }

    const subtab = e.target.closest('.hud-phone-subtab');
    if (subtab) {
      e.preventDefault();
      const scope = phoneScope(subtab);
      if (scope) {
        scope.querySelectorAll('.hud-phone-subtab').forEach(t => t.classList.remove('active'));
        scope.querySelectorAll('.hud-phone-subbody').forEach(b => b.classList.remove('active'));
        subtab.classList.add('active');
        const target = subtab.dataset.subtarget && scope.querySelector(`#${CSS.escape(subtab.dataset.subtarget)}`);
        if (target) target.classList.add('active');
      }
      return;
    }

    // Строка списка чатов и карточка уведомления открывают конкретную
    // переписку: id её тела совпадает с data-chat-target. Уведомление лежит
    // на домашнем экране, поэтому сначала поднимаем само приложение.
    const chatRow = e.target.closest('.hud-phone-chat-row, .hud-phone-notif, .hud-phone-lock-notice');
    if (chatRow && chatRow.dataset.chatTarget) {
      e.preventDefault();
      const emulator = chatRow.closest('.hud-phone-emulator');
      const stack = chatRow.closest('.hud-phone-notif-stack');
      // Уведомление с экрана блокировки: сначала снимаем замок, потом
      // открываем переписку — как на настоящем телефоне. Своей стопки у
      // него нет, поэтому приложение известно заранее: «Сообщения».
      const fromLock = chatRow.classList.contains('hud-phone-lock-notice');
      if (fromLock && emulator) emulator.classList.add('unlocked');
      let view = chatRow.closest('.hud-phone-app-view');
      if (emulator && (stack || fromLock)) {
        const appId = stack ? stack.dataset.phoneApp : 'messages';
        emulator.querySelectorAll('.hud-phone-app-view').forEach(v => {
          v.classList.toggle('active', v.dataset.phoneView === appId);
        });
        view = emulator.querySelector(`.hud-phone-app-view[data-phone-view="${CSS.escape(appId)}"]`);
      }
      const scope = view || phoneScope(chatRow) || emulator;
      const body = scope && scope.querySelector(`#${CSS.escape(chatRow.dataset.chatTarget)}`);
      if (view) openChat(view, body);
      else if (body) {
        scope.querySelectorAll('.hud-phone-subbody.active').forEach(b => b.classList.remove('active'));
        body.classList.add('active');
      }
      return;
    }

    // --- Телефонная ОС: открытие приложения и возврат на домашний экран.
    // Иконка приложения ИЛИ стопка уведомлений на домашнем экране несут
    // data-phone-app и открывают соответствующий экран. Открытое с иконки
    // приложение всегда показывает список, а не последнюю переписку.
    const phoneApp = e.target.closest('.hud-phone-app, .hud-phone-notif-stack');
    if (phoneApp) {
      e.preventDefault();
      const emulator = phoneApp.closest('.hud-phone-emulator');
      if (emulator) {
        const appId = phoneApp.dataset.phoneApp;
        emulator.querySelectorAll('.hud-phone-app-view').forEach(v => {
          const on = v.dataset.phoneView === appId;
          v.classList.toggle('active', on);
          if (on) openChat(v, null);
        });
      }
      return;
    }

    const phoneHome = e.target.closest('.hud-phone-home-btn');
    if (phoneHome) {
      e.preventDefault();
      const emulator = phoneHome.closest('.hud-phone-emulator');
      if (emulator) emulator.querySelectorAll('.hud-phone-app-view.active').forEach(v => {
        v.classList.remove('active');
        openChat(v, null);
      });
      return;
    }

    const dreamEntry = e.target.closest('.hud-dream-entry');
    if (dreamEntry) {
      const stage = Number(dreamEntry.getAttribute('data-crack') || 0);
      const next = (stage + 1) % 4;
      dreamEntry.setAttribute('data-crack', String(next));
      dreamEntry.classList.toggle('is-awake', next === 3);
      return;
    }

    const relGraph = e.target.closest('.hud-rel-graph');
    if (relGraph) {
      // Хвост перетаскивания: браузер всё равно шлёт click после отпускания.
      if (relGraph.dataset.relDragged) { delete relGraph.dataset.relDragged; return; }
      // «Связи / Семья»: вид меняется на месте и граф не раскрывает.
      const modeBtn = e.target.closest('.hud-rel-mode');
      if (modeBtn) {
        e.preventDefault();
        const mode = modeBtn.dataset.relMode === 'family' ? 'family' : 'graph';
        relGraph.dataset.relMode = mode;
        relGraph.querySelectorAll('.hud-rel-mode').forEach(b => {
          const on = b === modeBtn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        if (mode === 'family') applyRelGraphFocus(relGraph, '', '', '');
        return;
      }
      const clickedNode = e.target.closest('.hud-rel-node');
      const clickedEdge = e.target.closest('.hud-rel-edge, .hud-rel-edge-hit, .hud-rel-edge-badge');
      const clickedLabel = e.target.closest('.hud-rel-edge-label');
      const closeBtn = e.target.closest('.hud-rel-graph-close');

      if (closeBtn) {
        setRelGraphExpandedState(relGraph, false);
        applyRelGraphFocus(relGraph, '', '', '');
        return;
      }

      const clickedLegend = e.target.closest('.hud-rel-legend-item');
      if (clickedLegend && relGraph.contains(clickedLegend)) {
        e.preventDefault();
        const type = clickedLegend.dataset.relFilter || '';
        const nextType = relGraph.dataset.focusType === type ? '' : type;
        applyRelGraphFocus(relGraph, '', '', nextType);
        return;
      }

      if (clickedNode) {
        const nodeId = clickedNode.dataset.nodeId || '';
        const nextFocus = nodeId && relGraph.dataset.focusNode === nodeId ? '' : nodeId;
        applyRelGraphFocus(relGraph, nextFocus, '', '');
        return;
      }

      if (clickedEdge || clickedLabel) {
        const edgeKey = (clickedEdge || clickedLabel).dataset.edgeKey || '';
        const nextEdge = edgeKey && relGraph.dataset.focusEdge === edgeKey ? '' : edgeKey;
        applyRelGraphFocus(relGraph, '', nextEdge, '');
        return;
      }

      const hasAnyFocus = Boolean(relGraph.dataset.focusNode || relGraph.dataset.focusEdge || relGraph.dataset.focusType);
      applyRelGraphFocus(relGraph, '', '', '');
      if (hasAnyFocus) return;

      const isExpanded = relGraph.classList.contains('is-expanded');
      if (isExpanded) {
        return;
      }

      relGraph.dataset.zoom = '1';
      relGraph.style.setProperty('--hud-rel-zoom', '1');
      relGraph.dataset.panX = '0';
      relGraph.dataset.panY = '0';
      relGraph.style.setProperty('--hud-rel-pan-x', '0px');
      relGraph.style.setProperty('--hud-rel-pan-y', '0px');
      relGraph.classList.toggle('fx-active', true);
      setRelGraphExpandedState(relGraph, true);

      if (!relGraph.dataset.relZoomBound) {
        relGraph.dataset.relZoomBound = '1';

        // --- ПЕРЕТАСКИВАНИЕ ---------------------------------------------
        // Ставим на сцену, а не на всю панель: заголовок и кнопка закрытия
        // должны остаться обычными кнопками. Сдвиг держим в переменных, а не
        // в transform, чтобы он не спорил с масштабом.
        const stage = relGraph.querySelector('.hud-rel-stage');
        let drag = null;
        const setPan = (x, y) => {
          relGraph.dataset.panX = String(x);
          relGraph.dataset.panY = String(y);
          relGraph.style.setProperty('--hud-rel-pan-x', x + 'px');
          relGraph.style.setProperty('--hud-rel-pan-y', y + 'px');
        };
        const cancelPan = () => {
          if (!drag) return;
          try { stage.releasePointerCapture(drag.id); } catch (err) {}
          stage.classList.remove('is-panning');
          drag = null;
        };
        relGraph.hudCancelPan = cancelPan;

        if (stage) {
          stage.addEventListener('pointerdown', (ev) => {
            if (!relGraph.classList.contains('is-expanded')) return;
            if (ev.button !== undefined && ev.button > 0) return;
            // По узлам и подписям тянуть нельзя — это клики по деталям.
            if (ev.target.closest('.hud-rel-node, .hud-rel-edge-badge, .hud-rel-edge-label, .hud-rel-legend-item, .hud-rel-graph-close')) return;
            drag = {
              id: ev.pointerId, x: ev.clientX, y: ev.clientY, moved: 0,
              baseX: Number(relGraph.dataset.panX || 0),
              baseY: Number(relGraph.dataset.panY || 0),
            };
            try { stage.setPointerCapture(ev.pointerId); } catch (err) {}
            stage.classList.add('is-panning');
          });

          stage.addEventListener('pointermove', (ev) => {
            if (!drag || ev.pointerId !== drag.id) return;
            const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
            const dist = Math.hypot(dx, dy);
            if (dist > drag.moved) drag.moved = dist;
            setPan(drag.baseX + dx, drag.baseY + dy);
          });

          const endDrag = (ev) => {
            if (!drag || (ev && ev.pointerId !== drag.id)) return;
            // Протащили больше пары пикселей — это не клик: гасим следующий,
            // иначе он снимет выделение с узла сразу после перетаскивания.
            if (drag.moved > 4) relGraph.dataset.relDragged = '1';
            cancelPan();
          };
          stage.addEventListener('pointerup', endDrag);
          stage.addEventListener('pointercancel', endDrag);

          // Двойной щелчок по пустому месту — вернуть масштаб и центр.
          stage.addEventListener('dblclick', (ev) => {
            if (ev.target.closest('.hud-rel-node, .hud-rel-edge-badge, .hud-rel-edge-label')) return;
            relGraph.dataset.zoom = '1';
            relGraph.style.setProperty('--hud-rel-zoom', '1');
            setPan(0, 0);
          });
        }

        relGraph.addEventListener('wheel', (wheelEvent) => {
          if (!relGraph.classList.contains('is-expanded')) return;
          // В дереве колесо прокручивает сцену: масштаб там не используется.
          if (relGraph.dataset.relMode === 'family') return;
          wheelEvent.preventDefault();
          const current = Number(relGraph.dataset.zoom || 1);
          const delta = wheelEvent.deltaY > 0 ? -0.12 : 0.12;
          const next = Math.min(2.2, Math.max(0.7, current + delta));
          relGraph.dataset.zoom = String(next);
          relGraph.style.setProperty('--hud-rel-zoom', String(next));
        }, { passive: false });

        let pinchStart = null;
        relGraph.addEventListener('touchstart', (touchEvent) => {
          if (touchEvent.touches.length === 2 && relGraph.classList.contains('is-expanded')) {
            if (relGraph.hudCancelPan) relGraph.hudCancelPan();
            const dx = touchEvent.touches[0].clientX - touchEvent.touches[1].clientX;
            const dy = touchEvent.touches[0].clientY - touchEvent.touches[1].clientY;
            pinchStart = Math.hypot(dx, dy);
          }
        }, { passive: true });

        relGraph.addEventListener('touchmove', (touchEvent) => {
          if (!relGraph.classList.contains('is-expanded') || pinchStart === null || touchEvent.touches.length !== 2) return;
          const dx = touchEvent.touches[0].clientX - touchEvent.touches[1].clientX;
          const dy = touchEvent.touches[0].clientY - touchEvent.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          const scaleDelta = (dist - pinchStart) / 180;
          const current = Number(relGraph.dataset.zoom || 1);
          const next = Math.min(2.2, Math.max(0.7, current + scaleDelta * 0.16));
          relGraph.dataset.zoom = String(next);
          relGraph.style.setProperty('--hud-rel-zoom', String(next));
          pinchStart = dist;
        }, { passive: true });

        relGraph.addEventListener('touchend', () => { pinchStart = null; }, { passive: true });
      }
      return;
    }

    const relBackdrop = e.target.closest('.hud-rel-graph-backdrop');
    if (relBackdrop) {
      const graph = document.querySelector('.hud-rel-graph.is-expanded');
      if (graph) {
        setRelGraphExpandedState(graph, false);
        graph.classList.toggle('fx-active', false);
        applyRelGraphFocus(graph, '', '');
      }
      return;
    }

    const fxHost = e.target.closest('.hud-ad-card, .hud-breaking-news, .hud-dream-moon, .hud-route-map, .hud-phone-mockup.intercept-mode, .hud-diary-entry, .hud-world-section-forecast, .hud-world-section-horo');
    if (fxHost) {
      fxHost.classList.toggle('fx-active');
      return;
    }

    // Свернуть или развернуть погоду. Выбор общий для всех карточек и
    // помнится на устройстве; свёрнутая сцена по клику не оживает.
    const складка = e.target.closest('.hud-scene-fold');
    if (складка) {
      e.preventDefault();
      const свернуть = !складка.closest('.hud-scene-widget').classList.contains('is-compact');
      try { localStorage.setItem('hud-scene-compact', свернуть ? '1' : '0'); } catch (err) { /* хранилище недоступно */ }
      document.querySelectorAll('.hud-scene-widget').forEach(сцена => {
        сцена.classList.toggle('is-compact', свернуть);
        сцена.classList.remove('fx-active');
        сцена.classList.add('is-folding');
        setTimeout(() => сцена.classList.remove('is-folding'), 700);
        const кнопка = сцена.querySelector('.hud-scene-fold');
        if (кнопка) {
          const подпись = свернуть ? 'Развернуть погоду' : 'Свернуть погоду';
          кнопка.title = подпись; кнопка.setAttribute('aria-label', подпись);
          кнопка.setAttribute('aria-expanded', свернуть ? 'false' : 'true');
        }
      });
      return;
    }

    const widget = e.target.closest('.hud-scene-widget');
    if (widget && !widget.classList.contains('is-compact')) {
      widget.classList.toggle('fx-active');
    }

  }, true); 

  // ОБРАБОТЧИК ПОЛЗУНКОВ ЦВЕТА И ТЕМЫ
  // Поля кастомизации подтягиваются к текущим настройкам. Панель целиком
  // не перерисовываем — открытые вкладки схлопнулись бы.
  function syncThemeInputs() {
    document.querySelectorAll('.hud-theme-color-input, .hud-theme-range-input, .hud-theme-select-input').forEach(inp => {
      const k = inp.dataset.key;
      if (!k || settings[k] === undefined) return;
      inp.value = settings[k];
      const label = inp.nextElementSibling;
      if (label && label.tagName === 'SPAN') {
        label.textContent = /Alpha$|Opacity$|Scale$|OffsetY$/.test(k) ? settings[k] + '%'
          : /Blur$|Radius$|Size$/.test(k) ? settings[k] + 'px' : settings[k];
      }
    });
  }

  // Ряд пресетов пересобираем, когда появляется или исчезает своя тема.
  function redrawPresets() {
    document.querySelectorAll('.hud-theme-presets-row').forEach(row => {
      row.innerHTML = presetRowHTML(settings.themePreset);
    });
    document.querySelectorAll('.hud-theme-acts').forEach(box => {
      const has = box.querySelector('[data-theme-act="forget"]');
      if (settings.customTheme && !has) {
        box.insertAdjacentHTML('beforeend',
          '<button type="button" class="hud-theme-act danger" data-theme-act="forget" title="Удалить сохранённую свою тему">✕ Удалить свою</button>');
      } else if (!settings.customTheme && has) has.remove();
    });
    syncThemeInputs();
  }

  // --- Экран блокировки: разблокировка свайпом вверх --------------------
  // Жест ведут пальцем, поэтому слушаем pointer-события. Простой тап
  // телефон не открывает: иначе замок не имел бы смысла. Тап по карточке
  // уведомления разблокирует и открывает чат — это делает click-хендлер.
  const LOCK_UNLOCK_PX = 64;  // сколько нужно протянуть
  const LOCK_SLOP_PX = 8;     // до этого движение считается тапом
  document.addEventListener('pointerdown', function (e) {
    const lock = e.target.closest('.hud-phone-lockscreen');
    if (!lock || lock.dataset.dragging === '1') return;
    const emulator = lock.closest('.hud-phone-emulator');
    if (!emulator || emulator.classList.contains('unlocked')) return;
    const startY = e.clientY, startedAt = Date.now();
    let dy = 0;
    lock.dataset.dragging = '1';
    try { lock.setPointerCapture(e.pointerId); } catch (err) {}

    const onMove = (ev) => {
      dy = startY - ev.clientY;
      if (dy <= LOCK_SLOP_PX) return;
      lock.classList.add('is-dragging');
      // Тянем экран за пальцем, но не дальше его собственной высоты.
      lock.style.setProperty('--lock-drag', Math.min(dy, lock.offsetHeight) + 'px');
    };
    const finish = () => {
      lock.removeEventListener('pointermove', onMove);
      lock.removeEventListener('pointerup', finish);
      lock.removeEventListener('pointercancel', finish);
      delete lock.dataset.dragging;
      try { lock.releasePointerCapture(e.pointerId); } catch (err) {}
      lock.classList.remove('is-dragging');
      lock.style.removeProperty('--lock-drag');
      // Либо протянули далеко, либо коротко и резко смахнули.
      const flick = (Date.now() - startedAt) < 260 && dy > 24;
      if (dy > LOCK_UNLOCK_PX || flick) emulator.classList.add('unlocked');
    };
    lock.addEventListener('pointermove', onMove);
    lock.addEventListener('pointerup', finish);
    lock.addEventListener('pointercancel', finish);
  });

  // Клавиатура: Enter или пробел на экране блокировки снимают замок.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    const lock = e.target.closest && e.target.closest('.hud-phone-lockscreen');
    if (!lock || e.target.closest('.hud-phone-lock-notice')) return;
    const emulator = lock.closest('.hud-phone-emulator');
    if (!emulator) return;
    e.preventDefault();
    emulator.classList.add('unlocked');
  });

  document.body.addEventListener('input', function(e) {
    const themeInput = e.target.closest('.hud-theme-color-input, .hud-theme-range-input, .hud-theme-select-input, .hud-theme-text-input');
    if (themeInput) {
        const varKey = themeInput.dataset.key;
        
        if (varKey === 'bgImage') return; 
        
        settings[varKey] = themeInput.value;
        
        applyThemeColors(); 
        saveSettings();     
        
        let displayVal = themeInput.nextElementSibling;
        if (displayVal && displayVal.tagName === 'SPAN') {
            // Единица зависит от ключа: раньше всем подписям дописывалось
            // «px», и процент свечения показывался как «55px».
            displayVal.textContent = themeInput.value
              + (/Alpha$|Opacity$|Scale$|Darkness$/.test(varKey) ? '%' : 'px');
        }
        
        document.querySelectorAll(`[data-key="${varKey}"]`).forEach(inp => {
            if (inp !== themeInput) inp.value = themeInput.value;
        });
    }
  });

}

/* ---------------------------------------------------------------------
   СВАЙП ПО КАРТОЧКЕ НЕ МЕНЯЕТ ВАРИАНТ ОТВЕТА
   ---------------------------------------------------------------------
   Библиотека свайпов рождает своё событие от узла, где палец коснулся, и
   оно всплывает к document, где его ждёт SillyTavern. Гасить касания
   мало: при горизонтальной прокрутке полосы вкладок touchmove доходит не
   всегда, а событие свайпа рождается всё равно.
   Поэтому ловим его само — в фазе погружения, раньше обработчика
   SillyTavern на том же document. Начался жест внутри карточки — гасим.
   Проза не задета: там жест начинается вне карточки, и свайп работает. */
const СОБЫТИЯ_СВАЙПА = ['swiped', 'swiped-left', 'swiped-right', 'swiped-up', 'swiped-down'];
for (const тип of СОБЫТИЯ_СВАЙПА) {
  document.addEventListener(тип, (e) => {
    const узел = e.target;
    if (!узел || !узел.closest) return;
    // Карточка целиком: полоса вкладок, подвкладки телефона, переписка,
    // граф — всё, что листается пальцем внутри.
    if (!узел.closest('.hud-os-card, .hud-rel-graph, .hud-modal-overlay, .hud-arc-window')) return;
    e.stopPropagation();
    e.stopImmediatePropagation();
  }, true);
}

/* ---------------------------------------------------------------------
   РЕАКЦИИ НА СООБЩЕНИЯ В МЕССЕНДЖЕРЕ
   ---------------------------------------------------------------------
   Пометки ставит человек, а не модель, поэтому они не попадают ни в текст
   сообщения, ни в запрос. Ключ — отпечаток самого сообщения: карточка
   пересобирается по многу раз, и привязываться к её узлам бессмысленно. */
const НАБОР_РЕАКЦИЙ = ['❤️', '😂', '😮', '😢', '😡', '👍', '👎', '🔥'];
const КЛЮЧ_РЕАКЦИЙ = 'hud_reactions';
let реакции = null;

function загрузитьРеакции() {
  if (реакции) return реакции;
  try { реакции = JSON.parse(localStorage.getItem(КЛЮЧ_РЕАКЦИЙ) || '{}') || {}; }
  catch (_) { реакции = {}; }
  return реакции;
}

function сохранитьРеакции() {
  try { localStorage.setItem(КЛЮЧ_РЕАКЦИЙ, JSON.stringify(реакции || {})); }
  catch (err) { console.debug('[TavernOS HUD] реакции не сохранились:', err); }
}

// Отпечаток пузыря. Ключ ставится при сборке из исходной строки сообщения
// и потому не зависит ни от пересборки карточки, ни от того, что на пузырь
// уже навесили пометку. Считать по textContent нельзя: поставленная
// пометка тут же попадала бы в собственный отпечаток.
function отпечатокПузыря(пузырь) {
  const ключ = пузырь && пузырь.dataset ? пузырь.dataset.msgKey : '';
  if (!ключ) return '';
  // Один и тот же текст может встретиться в разных переписках, поэтому к
  // ключу добавляем имя чата.
  const чат = пузырь.closest('.hud-phone-app-view, .hud-phone-mockup, .hud-intercept-card');
  const имя = чат && чат.querySelector('.hud-phone-name, .hud-intercept-chat-name');
  const подпись = имя ? (имя.textContent || '').trim() : '';
  return подпись ? подпись + '\u0000' + ключ : ключ;
}

// Рисуем пометки под пузырём. Вызывается и после установки, и при разборе
// свежесобранной карточки.
function показатьРеакции(пузырь) {
  const ключ = отпечатокПузыря(пузырь);
  if (!ключ) return;
  const список = загрузитьРеакции()[ключ] || [];
  let полка = пузырь.querySelector(':scope > .hud-msg-reactions');
  if (!список.length) { if (полка) полка.remove(); return; }
  if (!полка) {
    полка = document.createElement('div');
    полка.className = 'hud-msg-reactions';
    пузырь.appendChild(полка);
  }
  полка.innerHTML = список.map(з =>
    `<span class="hud-msg-reaction" data-reaction="${з}" role="button" tabindex="0" title="Убрать">${з}</span>`
  ).join('');
}

export function refreshReactions(корень) {
  if (!корень || !корень.querySelectorAll) return;
  корень.querySelectorAll('.hud-msg-bubble').forEach(показатьРеакции);
}

function открытьПалитру(пузырь) {
  document.querySelectorAll('.hud-reaction-palette').forEach(п => п.remove());
  const палитра = document.createElement('div');
  палитра.className = 'hud-reaction-palette';
  палитра.innerHTML = НАБОР_РЕАКЦИЙ.map(з =>
    `<button type="button" class="hud-reaction-pick" data-pick="${з}">${з}</button>`
  ).join('');
  пузырь.appendChild(палитра);
  // Закрываем по первому же нажатию мимо палитры.
  const закрыть = (e) => {
    if (палитра.contains(e.target)) return;
    палитра.remove();
    document.removeEventListener('pointerdown', закрыть, true);
  };
  setTimeout(() => document.addEventListener('pointerdown', закрыть, true), 0);
}

// Долгое нажатие пальцем и правая кнопка мышью — два пути к одному и тому
// же. Считаем долгим полсекунды без заметного сдвига: иначе палитра
// открывалась бы посреди прокрутки.
let держим = 0, началоКасания = null;

// Слежку за движением включаем только на время долгого нажатия и тут же
// снимаем. Держать её на документе постоянно — значит вызывать обработчик
// на каждое движение мыши по всей странице, а нужна она полсекунды.
function бросить() {
  clearTimeout(держим); держим = 0; началоКасания = null;
  document.removeEventListener('pointermove', наДвижении);
  document.removeEventListener('pointerup', бросить);
  document.removeEventListener('pointercancel', бросить);
}
function наДвижении(e) {
  if (!началоКасания) return;
  // Небольшой сдвиг — это дрожь пальца, заметный — прокрутка: тогда
  // палитру не открываем.
  if (Math.abs(e.clientX - началоКасания.x) > 8 || Math.abs(e.clientY - началоКасания.y) > 8) бросить();
}
document.addEventListener('pointerdown', (e) => {
  const пузырь = e.target.closest && e.target.closest('.hud-msg-bubble');
  if (!пузырь) return;
  if (e.target.closest('.hud-reaction-palette, .hud-msg-reaction, .hud-msg-media')) return;
  началоКасания = { x: e.clientX, y: e.clientY };
  clearTimeout(держим);
  держим = setTimeout(() => { открытьПалитру(пузырь); бросить(); }, 500);
  document.addEventListener('pointermove', наДвижении);
  document.addEventListener('pointerup', бросить);
  document.addEventListener('pointercancel', бросить);
});
document.addEventListener('contextmenu', (e) => {
  const пузырь = e.target.closest && e.target.closest('.hud-msg-bubble');
  if (!пузырь) return;
  e.preventDefault();
  открытьПалитру(пузырь);
});

document.addEventListener('click', (e) => {
  // Выбор из палитры.
  const выбор = e.target.closest && e.target.closest('.hud-reaction-pick');
  if (выбор) {
    e.preventDefault(); e.stopPropagation();
    const пузырь = выбор.closest('.hud-msg-bubble');
    const ключ = пузырь && отпечатокПузыря(пузырь);
    if (ключ) {
      const всё = загрузитьРеакции();
      const список = всё[ключ] || [];
      const знак = выбор.dataset.pick;
      всё[ключ] = список.includes(знак) ? список.filter(з => з !== знак) : список.concat(знак);
      if (!всё[ключ].length) delete всё[ключ];
      сохранитьРеакции();
      показатьРеакции(пузырь);
    }
    выбор.closest('.hud-reaction-palette')?.remove();
    return;
  }
  // Нажатие по уже поставленной пометке убирает её.
  const пометка = e.target.closest && e.target.closest('.hud-msg-reaction');
  if (пометка) {
    e.preventDefault(); e.stopPropagation();
    const пузырь = пометка.closest('.hud-msg-bubble');
    const ключ = пузырь && отпечатокПузыря(пузырь);
    if (ключ) {
      const всё = загрузитьРеакции();
      всё[ключ] = (всё[ключ] || []).filter(з => з !== пометка.dataset.reaction);
      if (!всё[ключ].length) delete всё[ключ];
      сохранитьРеакции();
      показатьРеакции(пузырь);
    }
  }
}, true);

// Реакции живут отдельно от чата, и забыть их нужно уметь отдельно.
export function clearReactions() {
  реакции = {};
  try { localStorage.removeItem(КЛЮЧ_РЕАКЦИЙ); } catch (_) {}
  document.querySelectorAll('.hud-msg-reactions').forEach(п => п.remove());
}

export function initObserver(ctx, chatContainer) {
  const { safeProcessMessage, isPerformanceModeActive, refreshPerformanceMessageClasses,
          schedulePerformanceRefresh, getPerformanceObserver } = ctx;
  if (observer) {
    observer.disconnect();
    // Копилка привязана к прежнему контейнеру: её содержимое больше не имеет
    // смысла, а отложенный разбор дёрнул бы отсоединённые узлы.
    отменитьРазбор();
  }

  observer = new MutationObserver((mutations) => {
    const touchedMessages = new Set();
    let avatarChanged = false;

    for (const mutation of mutations) {
      // Изменился текст внутри сообщения.
      if (mutation.type === 'characterData') {
        const mes = mutation.target.parentElement?.closest?.('.mes');
        if (mes) { touchedMessages.add(mes); }
      }

      // Добавились новые DOM-ноды.
      mutation.addedNodes.forEach(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches?.('.mes')) {
          touchedMessages.add(node);
          avatarChanged = true;
          const poNode = getPerformanceObserver(); if (poNode) poNode.observe(node);
        }
        node.querySelectorAll?.('.mes').forEach(mes => {
          touchedMessages.add(mes);
          avatarChanged = true;
          const poMes = getPerformanceObserver(); if (poMes) poMes.observe(mes);
        });
        if (node.matches?.('.avatar img, .avatar_img') || node.querySelector?.('.avatar img, .avatar_img')) avatarChanged = true;
        const parentMes = node.closest?.('.mes');
        if (parentMes) touchedMessages.add(parentMes);
      });

      // Изменение childList внутри существующего сообщения.
      if (mutation.type === 'childList') {
        const targetMes = mutation.target.closest?.('.mes');
        if (targetMes) touchedMessages.add(targetMes);
        if (mutation.target.closest?.('.avatar, .avatar img') || mutation.target.matches?.('.avatar, .avatar img')) avatarChanged = true;
      }
    }

    if (!touchedMessages.size) return;
    touchedMessages.forEach(mes => ЖДУЩИЕ.add(mes));
    if (avatarChanged) аватаркиМенялись = true;

    const разобрать = () => {
      разборТаймер = 0;
      разборНачат = 0;
      const пачка = [...ЖДУЩИЕ];
      ЖДУЩИЕ.clear();
      if (аватаркиМенялись) { invalidateAvatarCache(); аватаркиМенялись = false; }

      const performanceActive = isPerformanceModeActive(chatContainer);
      пачка.forEach(mes => {
        if (!mes.isConnected) return;
        // В Performance Mode старые сообщения не гоняем через полный процессор на каждую
        // внутреннюю мутацию. IntersectionObserver обработает их, когда они приблизятся к экрану.
        if (performanceActive && mes.classList.contains('hud-perf-older') && !mes.classList.contains('hud-perf-visible')) return;
        safeProcessMessage(mes);
      });
      if (performanceActive) refreshPerformanceMessageClasses();
      schedulePerformanceRefresh();
    };

    const сейчас = Date.now();
    if (!разборНачат) разборНачат = сейчас;
    if (разборТаймер) clearTimeout(разборТаймер);
    // Ждём тишины, но если поток мутаций не прекращается — разбираем по потолку.
    const осталось = Math.max(0, РАЗБОР_ПОТОЛОК - (сейчас - разборНачат));
    разборТаймер = setTimeout(разобрать, Math.min(РАЗБОР_ТИШИНА, осталось));
  });

  observer.observe(chatContainer, {
    childList: true,
    subtree: true,
    characterData: true,
    characterDataOldValue: false
  });
}

// Вопросик у вкладки тоже объявлен role="button": Enter и пробел должны
// его открывать.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const вопросик = e.target && e.target.closest && e.target.closest('.hud-help-mark');
  if (!вопросик) return;
  e.preventDefault();
  вопросик.click();
});

// Плитка вложения объявлена role="button" — значит обязана открываться и
// с клавиатуры, иначе роль обещает то, чего нет.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const media = e.target && e.target.closest && e.target.closest('.hud-msg-media');
  if (!media) return;
  e.preventDefault();
  openPhoneMediaViewer(media);
});

export function initTavernOSEvents(ctx) {
  const { safeProcessMessage, getChatContainer } = ctx;
if (window.hudTavernEventsInitialized) return;
window.hudTavernEventsInitialized = true;

try {
  const stContext =
    window.SillyTavern?.getContext?.() ||
    window.getContext?.();

  const eventSource = stContext?.eventSource;
  const eventTypes = stContext?.event_types;

  if (!eventSource || !eventTypes) return;

  const rerenderMessage = (messageId, delay = 50) => {
    const id = String(messageId);
    setTimeout(() => {
      let mes = null;
      const safeId = (window.CSS && typeof window.CSS.escape === 'function') ? window.CSS.escape(id) : id.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
      try {
        mes = getChatContainer()?.querySelector?.(`.mes[mesid=\"${safeId}\"]`) || null;
      } catch (_) {}
      if (!mes) {
        mes = Array.from(getChatContainer()?.querySelectorAll?.('.mes') || []).find(el => String(el.getAttribute('mesid')) === id);
      }

      if (!mes) return;

      requestAnimationFrame(() => {
        if (mes.isConnected) safeProcessMessage(mes);
      });
    }, delay);
  };

  if (eventTypes.MESSAGE_UPDATED) {
    eventSource.on(eventTypes.MESSAGE_UPDATED, (messageId) => rerenderMessage(messageId, 50));
  }

  if (eventTypes.MESSAGE_SWIPED) {
    eventSource.on(eventTypes.MESSAGE_SWIPED, (messageId) => rerenderMessage(messageId, 50));
  }

  if (eventTypes.CHARACTER_MESSAGE_RENDERED) {
    eventSource.on(eventTypes.CHARACTER_MESSAGE_RENDERED, (messageId) => rerenderMessage(messageId, 30));
  }
} catch (_) {
  // Lifecycle events are optional; the normal message processing still works without them.
}
}


/* ---------------------------------------------------------------------
   ОБЛЕГЧЕНИЕ СТАРЫХ КАРТОЧЕК
   ---------------------------------------------------------------------
   Свёрнутая старая карточка показывает одну полосу заголовка, а внутри
   держала всё: панель настроек темы и сцену со вкладками — около тысячи
   узлов. В длинном чате это больше половины всей ленты, и телефон
   пересчитывал стили и вёрстку этих невидимых узлов при каждом изменении.

   Облегчаем: панель темы и содержимое уходят из документа, на их месте
   остаются метки-комментарии. Узлы не уничтожаются — живут на карточке
   вместе со своими обработчиками и состоянием и возвращаются при первом
   касании карточки, раньше, чем сработает клик по заголовку. */

let синхронизацияТемы = null;
const ЛЁГКИЕ_ЧАСТИ = ':scope > .hud-theme-panel, :scope > .hud-os-wrapper';

export function облегчитьКарточку(card) {
  if (!card || card.__hudLight || !card.isConnected) return false;
  if (card.closest('.hud-theme-preview')) return false;
  if (!card.classList.contains('hud-historical') || card.dataset.userExpanded === 'true') return false;
  const свёртка = card.querySelector(':scope > .hud-toggle-input');
  if (!свёртка || свёртка.checked) return false;
  // Открытая панель темы, фокус внутри или развёрнутый граф — карточкой
  // пользуются прямо сейчас.
  if (card.querySelector(':scope > .hud-theme-panel.active')) return false;
  if (document.activeElement && card.contains(document.activeElement)) return false;
  if (card.querySelector('.hud-rel-graph.is-expanded, .hud-modal-overlay')) return false;
  const части = Array.from(card.querySelectorAll(ЛЁГКИЕ_ЧАСТИ));
  if (!части.length) return false;
  card.__hudLight = части.map(узел => {
    const метка = document.createComment('hud-light');
    узел.replaceWith(метка);
    return { метка, узел };
  });
  return true;
}

export function вернутьКарточку(card) {
  const части = card && card.__hudLight;
  if (!части) return false;
  delete card.__hudLight;
  for (const { метка, узел } of части) {
    if (метка.parentNode) метка.replaceWith(узел);
    else card.appendChild(узел);
  }
  if (синхронизацияТемы) {
    try { синхронизацияТемы(); } catch (e) { console.warn('[TavernOS HUD] тема после облегчения:', e); }
  }
  return true;
}

// Возврат при любом обращении к карточке. Фаза захвата: карточка должна
// собраться до того, как свои обработчики полезут в её содержимое.
function вернутьПоСобытию(e) {
  const card = e.target && e.target.closest && e.target.closest('.hud-os-card');
  if (card && card.__hudLight) вернутьКарточку(card);
}
['pointerdown', 'click', 'keydown', 'focusin', 'touchstart'].forEach(тип => {
  document.addEventListener(тип, вернутьПоСобытию, { capture: true, passive: true });
});


// --- Движение по касанию -----------------------------------------------------
// Украшения карточки стоят на месте, пока их не тронуть. Под курсором их
// запускает :hover, на телефоне наведения нет — поэтому касание вешает на
// ближайший оживающий элемент класс fx-tap на пару секунд (повторное касание
// перезапускает движение), а на саму карточку — fx-live, чтобы ожили и слои
// темы. Обработчик пассивный и ничего не отменяет: клики живут как раньше.
const ОЖИВАЮТ_ПО_КАСАНИЮ = ".hud-key-item, .hud-detail-pill, .hud-inventory-pill, .hud-conflict-pill, .hud-kink-pill, .hud-fetish-pill, .hud-nogo-pill, .hud-noturn-pill, .hud-nsfw-pill, .hud-schedule-event, .hud-exp-reality, .hud-phase-step, .hud-fear, .hud-ill, .hud-prg, .hud-zone, .hud-perc, .hud-scene-chip, .hud-prot, .hud-org, .hud-vit, .hud-sound, .hud-heat-row, .hud-mark, .hud-cycle-badge, .hud-eco-row, .hud-afisha-card, .hud-city-row, .hud-news-article, .hud-world-list li, .hud-comment, .hud-horo-card, .hud-timeline-content, .hud-mood-chip, .hud-gun, .hud-pet, .hud-line-quote, .hud-phone-contact, .hud-phone-photo-card, .hud-phone-lock-notice, .hud-phone-note, .hud-phone-chat-row, .hud-phone-search-row, .hud-phone-map-row, .hud-row, .hud-heat, .hud-cycle, .hud-secret-summary, .hud-fam-svg, .hud-phone-app, .hud-phone-lockscreen, .hud-mood-group, .hud-scene-strip-wrap";
const таймерыОживления = new WeakMap();
function оживить(элемент, класс, мс) {
  clearTimeout(таймерыОживления.get(элемент));
  if (класс === 'fx-tap' && элемент.classList.contains(класс)) {
    элемент.classList.remove(класс);
    void элемент.offsetWidth;
  }
  элемент.classList.add(класс);
  таймерыОживления.set(элемент, setTimeout(() => элемент.classList.remove(класс), мс));
}
document.addEventListener('pointerup', (e) => {
  const карточка = e.target.closest && e.target.closest('.hud-os-card');
  if (!карточка) return;
  const цель = e.target.closest(ОЖИВАЮТ_ПО_КАСАНИЮ);
  if (цель && карточка.contains(цель)) оживить(цель, 'fx-tap', 3600);
  if (e.pointerType && e.pointerType !== 'mouse') оживить(карточка, 'fx-live', 9000);
}, { passive: true });

