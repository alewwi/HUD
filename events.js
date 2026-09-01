// hud-manager/events.js
//
// Домен «События»: глобальные обработчики UI, MutationObserver за контейнером
// чата и подписка на жизненный цикл SillyTavern.
//
// В отличие от остальных модулей, здесь пришлось ввести один шов: обработчики
// дёргают функции и состояние, которые остались в index.js. Они передаются
// одним объектом ctx при инициализации. Изменяемое состояние передаётся
// геттерами, а не значениями:
//   getChatContainer()       — cachedChatContainer переприсваивается в initApp;
//   getPerformanceObserver() — IntersectionObserver создаётся и сбрасывается
//                              perf-кластером в index.js по мере смены режима.
// Функции — стабильные ссылки. settings сюда больше не передаётся: модуль
// импортирует живой синглтон из settings.js напрямую.

import { settings } from './settings.js';
import { invalidateAvatarCache } from './avatars.js';
import { getWorldVotes } from './render/world.js';
import { applyRelGraphFocus, setRelGraphExpandedState } from './render/relations-graph.js';

// Приватен для модуля: initObserver — единственное место создания.
let observer = null;

// Пометить переписку прочитанной: снять счётчики со строки списка, убрать
// её уведомление со стопки и пересчитать общий бейдж и значок на иконке.
// Работает на уровне DOM: сам HUD-блок в сообщении не переписываем, это
// состояние просмотра, а не данные.
// Точная высота каждой карточки уведомления в переменную --notif-h.
// Карточки бывают в одну и в две строки, а сжатие стопки задаётся
// отрицательным отступом — без реальной высоты задние выглядывали неровно.
// Раскладка стопки уведомлений задаётся инлайном из JS, а не каскадом CSS.
// В файле стилей это место оказалось перегружено несколькими поколениями
// правил, и margin у раскрытого состояния переставал применяться. Инлайн
// снимает вопрос: он всегда выигрывает, а переходы по-прежнему делает CSS.
function hudLayoutNotifStack(stack) {
  if (!stack) return;
  const open = stack.classList.contains('is-open');
  const cards = [...stack.querySelectorAll('.hud-phone-notif')];
  cards.forEach((card, i) => {
    card.style.setProperty('--depth', String(i));
    if (open) {
      card.style.marginTop = i === 0 ? '0px' : '7px';
      card.style.transform = 'none';
      card.style.opacity = '';
    } else {
      const h = Math.round(card.getBoundingClientRect().height) || 58;
      // Задняя карточка выглядывает на 9px из-под передней.
      card.style.marginTop = i === 0 ? '0px' : `-${Math.max(0, h - 9)}px`;
      card.style.transform = `scale(${(1 - i * 0.045).toFixed(3)})`;
      card.style.opacity = String(1 - i * 0.12);
    }
  });
}

function hudMeasureNotifCards(stack) {
  if (!stack) return;
  stack.querySelectorAll('.hud-phone-notif').forEach(card => {
    const h = Math.round(card.getBoundingClientRect().height);
    if (h > 0) card.style.setProperty('--notif-h', h + 'px');
  });
}

function hudMarkChatRead(scopeEl, chatTarget) {
  if (!scopeEl || !chatTarget) return;
  const emulator = scopeEl.closest('.hud-phone-emulator') || scopeEl;

  // 1. Бейдж непрочитанного у строки чата.
  const row = emulator.querySelector(`.hud-phone-chat-row[data-chat-target="${CSS.escape(chatTarget)}"]`);
  if (row) row.querySelectorAll('.hud-unread-badge').forEach(b => b.remove());

  // 2. Карточка уведомления этой переписки.
  const stack = emulator.querySelector('.hud-phone-notif-stack');
  const card = stack && stack.querySelector(`.hud-phone-notif[data-chat-target="${CSS.escape(chatTarget)}"]`);
  if (card) card.remove();

  // Зашли в переписку — стопка возвращается в свёрнутый вид,
  // чтобы на домашнем экране она снова была одной аккуратной полоской.
  if (stack) stack.classList.remove("is-open");

  // 3. Пересчёт: сумма оставшихся уведомлений.
  let left = 0;
  if (stack) {
    stack.querySelectorAll('.hud-phone-notif').forEach((c, i) => {
      c.style.setProperty('--depth', String(i));
      const per = c.querySelector('.hud-phone-notif-meta i');
      left += per ? (parseInt(per.textContent, 10) || 1) : 1;
    });
    const total = stack.querySelector('.hud-phone-notif-count');
    if (total) total.textContent = String(left);
    // Стопка без уведомлений не нужна.
    if (!stack.querySelector('.hud-phone-notif')) stack.remove();
  }

  if (stack) { hudMeasureNotifCards(stack); hudLayoutNotifStack(stack); }

  // 4. Значок на иконке «Сообщения».
  const appBadge = emulator.querySelector('.hud-phone-app[data-phone-app="messages"] .hud-unread-badge');
  if (appBadge) {
    if (left > 0) appBadge.textContent = String(left);
    else appBadge.remove();
  }
}

export function initGlobalEvents(ctx) {
  const { saveSettings, applyThemeColors, showHudToast } = ctx;
  if (window.hudEventsInitialized) return;
  window.hudEventsInitialized = true;

  document.body.addEventListener('change', function(e) {
    // Переключатель «наследовать тему HUD» живёт внутри карточки HUD, а карточек
    // в чате много — поэтому ловим его делегированно по классу, а не по id.
    const phoneAuto = e.target.closest('.hud-phone-theme-auto');
    if (phoneAuto) {
      settings.phoneThemeAuto = phoneAuto.checked;
      // Синхронизируем остальные копии переключателя в других карточках.
      document.querySelectorAll('.hud-phone-theme-auto').forEach(box => { box.checked = phoneAuto.checked; });
      saveSettings();
      applyThemeColors();
      return;
    }

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

    const loreTip = e.target.closest('.hud-lore-tooltip');
    if (loreTip) {
      e.preventDefault();
      e.stopPropagation();
      const wasOpen = loreTip.classList.contains('tooltip-open');
      document.querySelectorAll('.hud-lore-tooltip.tooltip-open').forEach(el => { if (el !== loreTip) el.classList.remove('tooltip-open'); });
      loreTip.classList.toggle('tooltip-open', !wasOpen);
      return;
    }
    document.querySelectorAll('.hud-lore-tooltip.tooltip-open').forEach(el => el.classList.remove('tooltip-open'));

    const themeBtn = e.target.closest('.hud-theme-btn');
    if (themeBtn) {
      e.preventDefault();
      e.stopPropagation();
      const card = themeBtn.closest('.hud-os-card');
      const panel = card.querySelector('.hud-theme-panel');
      if (panel) panel.classList.toggle('active');
      return;
    }

    const hudActionBtn = e.target.closest && e.target.closest('.hud-regen-btn');
    if (hudActionBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      void handleHudRegenButton(hudActionBtn);
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

    const tab = e.target.closest('.hud-tab');
    if (tab) {
      e.preventDefault();
      const parent = tab.closest('.hud-os-wrapper');
      parent.querySelectorAll('.hud-tab').forEach(t => t.classList.remove('active'));
      parent.querySelectorAll('.hud-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      parent.querySelector(`#${tab.dataset.target}`).classList.add('active');
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
    // эмулятора, в перехватах — старый .hud-phone-mockup. Ищем любой из них,
    // чтобы переключение подвкладок работало в обоих случаях.
    const phoneScope = (el) => el.closest('.hud-phone-app-view, .hud-phone-mockup');

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

    // Открытие чата из списка: приложение переключается со списка на переписку.
    const chatRow = e.target.closest('.hud-phone-chat-row');
    if (chatRow) {
      e.preventDefault();
      const view = chatRow.closest('.hud-phone-app-view');
      if (view) {
        view.querySelectorAll('.hud-phone-subbody').forEach(b => b.classList.remove('active'));
        const target = chatRow.dataset.chatTarget && view.querySelector(`#${CSS.escape(chatRow.dataset.chatTarget)}`);
        if (target) target.classList.add('active');
        view.classList.add('is-chat-open');
        const area = target && target.querySelector('.hud-phone-chat-area');
        if (area) area.scrollTop = area.scrollHeight;
        // Зашли в переписку — она прочитана.
        hudMarkChatRead(view, chatRow.dataset.chatTarget);
      }
      return;
    }

    // Стрелка «назад»: из переписки — к списку чатов, со списка — на домашний экран.
    const phoneBack = e.target.closest('.hud-phone-back');
    if (phoneBack) {
      const view = phoneBack.closest('.hud-phone-app-view');
      if (view && view.classList.contains('is-chat-open')) {
        e.preventDefault();
        view.classList.remove('is-chat-open');
        view.querySelectorAll('.hud-phone-subbody').forEach(b => b.classList.remove('active'));
        return;
      }
      const emulator = phoneBack.closest('.hud-phone-emulator');
      if (emulator) {
        e.preventDefault();
        emulator.querySelectorAll('.hud-phone-app-view.active').forEach(v => {
          v.classList.remove('active');
          v.classList.remove('is-chat-open');
        });
        return;
      }
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

    const dreamEntry = e.target.closest('.hud-dream-entry');
    if (dreamEntry) {
      const stage = Number(dreamEntry.getAttribute('data-crack') || 0);
      const next = (stage + 1) % 4;
      dreamEntry.setAttribute('data-crack', String(next));
      dreamEntry.classList.toggle('is-awake', next === 3);
      return;
    }

    // --- Телефонная ОС: открытие приложения и возврат на домашний экран ---
    // Иконка приложения ИЛИ стопка уведомлений на домашнем экране — оба
    // несут data-phone-app и открывают соответствующий экран.
    // Стопка уведомлений: первый тап раскрывает её, тап по конкретному
    // уведомлению уже открывает «Сообщения». Так работает одинаково и на
    // телефоне, и на десктопе — раскрытие больше не завязано на hover.
    const notifStack = e.target.closest('.hud-phone-notif-stack');
    if (notifStack) {
      e.preventDefault();
      hudMeasureNotifCards(notifStack);
      hudLayoutNotifStack(notifStack);
      const card = e.target.closest('.hud-phone-notif');
      if (!notifStack.classList.contains('is-open')) {
        notifStack.classList.add("is-open");
        hudLayoutNotifStack(notifStack);
        return;
      }
      if (!card) {
        // Повторный тап мимо карточек — сворачиваем обратно.
        notifStack.classList.remove("is-open");
        hudLayoutNotifStack(notifStack);
        return;
      }
      const target = card.dataset.chatTarget;
      const emulator = notifStack.closest(".hud-phone-emulator");
      if (emulator) {
        emulator.querySelectorAll(".hud-phone-app-view").forEach(v => {
          v.classList.toggle("active", v.dataset.phoneView === "messages");
        });
        // Открываем именно тот чат, о котором было уведомление, и гасим его.
        const view = emulator.querySelector(".hud-phone-app-view[data-phone-view='messages']");
        if (view && target) {
          view.querySelectorAll(".hud-phone-subbody").forEach(b => b.classList.remove("active"));
          const body = view.querySelector("#" + CSS.escape(target));
          if (body) body.classList.add("active");
          view.classList.add("is-chat-open");
          hudMarkChatRead(emulator, target);
        }
      }
      return;
    }

    const phoneApp = e.target.closest('.hud-phone-app');
    if (phoneApp) {
      e.preventDefault();
      const emulator = phoneApp.closest('.hud-phone-emulator');
      if (emulator) {
        const appId = phoneApp.dataset.phoneApp;
        emulator.querySelectorAll('.hud-phone-app-view').forEach(v => {
          v.classList.toggle('active', v.dataset.phoneView === appId);
        });
      }
      return;
    }

    const phoneHome = e.target.closest('.hud-phone-home-btn');
    if (phoneHome) {
      e.preventDefault();
      const emulator = phoneHome.closest('.hud-phone-emulator');
      if (emulator) emulator.querySelectorAll('.hud-phone-app-view.active').forEach(v => v.classList.remove('active'));
      return;
    }

    const relGraph = e.target.closest('.hud-rel-graph');
    if (relGraph) {
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

      // Фокус узла или связи тоже «оживляет» граф: без fx-active бегущий
      // пунктир по линиям не запускался, и нажатая связь оставалась статичной.
      if (clickedNode || clickedEdge || clickedLabel || clickedLegend) relGraph.classList.add("fx-active");

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
      relGraph.classList.toggle('fx-active', true);
      setRelGraphExpandedState(relGraph, true);

      if (!relGraph.dataset.relZoomBound) {
        relGraph.dataset.relZoomBound = '1';
        
        relGraph.addEventListener('wheel', (wheelEvent) => {
          if (!relGraph.classList.contains('is-expanded')) return;
          wheelEvent.preventDefault();
          
          const stageEl = relGraph.querySelector('.hud-rel-stage');
          const svgEl = relGraph.querySelector('.hud-rel-svg');
          if (!stageEl || !svgEl) return;
          
          const rect = stageEl.getBoundingClientRect();
          // Вычисляем положение курсора относительно контейнера
          const mx = wheelEvent.clientX - rect.left;
          const my = wheelEvent.clientY - rect.top;

          const current = Number(relGraph.dataset.zoom || 1);
          const tx = Number(relGraph.dataset.tx || 0);
          const ty = Number(relGraph.dataset.ty || 0);

          // Скорость зума
          const delta = wheelEvent.deltaY > 0 ? -0.15 : 0.15;
          const next = Math.min(4.0, Math.max(1, current + delta)); // Максимальное увеличение 4x

          // Математика центрирования к курсору
          const px = (mx - tx) / current;
          const py = (my - ty) / current;
          
          let newTx = mx - px * next;
          let newTy = my - py * next;

          // Если полностью отдалились, сбрасываем смещение
          if (next <= 1) { newTx = 0; newTy = 0; }

          relGraph.dataset.zoom = String(next);
          relGraph.dataset.tx = String(newTx);
          relGraph.dataset.ty = String(newTy);

          // Применяем точную трансформацию
          svgEl.style.transformOrigin = '0 0';
          svgEl.style.transform = `translate(${newTx}px, ${newTy}px) scale(${next})`;
        }, { passive: false });

        let pinchStartDist = null;
        let pinchStartCenter = null;
        let pinchStartTx = 0;
        let pinchStartTy = 0;
        let pinchStartZoom = 1;

        relGraph.addEventListener('touchstart', (touchEvent) => {
          if (touchEvent.touches.length === 2 && relGraph.classList.contains('is-expanded')) {
            const dx = touchEvent.touches[0].clientX - touchEvent.touches[1].clientX;
            const dy = touchEvent.touches[0].clientY - touchEvent.touches[1].clientY;
            pinchStartDist = Math.hypot(dx, dy);
            
            const stageEl = relGraph.querySelector('.hud-rel-stage');
            if(!stageEl) return;
            const rect = stageEl.getBoundingClientRect();
            
            // Находим центр между двумя пальцами
            pinchStartCenter = {
                x: ((touchEvent.touches[0].clientX + touchEvent.touches[1].clientX) / 2) - rect.left,
                y: ((touchEvent.touches[0].clientY + touchEvent.touches[1].clientY) / 2) - rect.top
            };
            pinchStartTx = Number(relGraph.dataset.tx || 0);
            pinchStartTy = Number(relGraph.dataset.ty || 0);
            pinchStartZoom = Number(relGraph.dataset.zoom || 1);
          }
        }, { passive: true });

        relGraph.addEventListener('touchmove', (touchEvent) => {
          if (!relGraph.classList.contains('is-expanded') || pinchStartDist === null || touchEvent.touches.length !== 2) return;
          const dx = touchEvent.touches[0].clientX - touchEvent.touches[1].clientX;
          const dy = touchEvent.touches[0].clientY - touchEvent.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          
          const scaleDelta = (dist - pinchStartDist) / 150;
          const next = Math.min(4.0, Math.max(1, pinchStartZoom + scaleDelta));

          const mx = pinchStartCenter.x;
          const my = pinchStartCenter.y;
          
          const px = (mx - pinchStartTx) / pinchStartZoom;
          const py = (my - pinchStartTy) / pinchStartZoom;
          
          let newTx = mx - px * next;
          let newTy = my - py * next;

          if (next <= 1) { newTx = 0; newTy = 0; }

          relGraph.dataset.zoom = String(next);
          relGraph.dataset.tx = String(newTx);
          relGraph.dataset.ty = String(newTy);

          const svgEl = relGraph.querySelector('.hud-rel-svg');
          if(svgEl) {
              svgEl.style.transformOrigin = '0 0';
              svgEl.style.transform = `translate(${newTx}px, ${newTy}px) scale(${next})`;
          }
        }, { passive: true });

        relGraph.addEventListener('touchend', () => { pinchStartDist = null; }, { passive: true });
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

    const fxHost = e.target.closest('.hud-ad-card, .hud-breaking-news, .hud-dream-moon, .hud-route-map');
    if (fxHost) {
      fxHost.classList.toggle('fx-active');
      return;
    }

    const widget = e.target.closest('.hud-scene-widget');
    if (widget) {
      widget.classList.toggle('fx-active');
    }

  }, true); 

  // ОБРАБОТЧИК ПОЛЗУНКОВ ЦВЕТА И ТЕМЫ
  document.body.addEventListener('input', function(e) {
    const themeInput = e.target.closest('.hud-theme-color-input, .hud-theme-range-input, .hud-theme-select-input, .hud-theme-text-input');
    if (themeInput) {
        const varKey = themeInput.dataset.key;
        
        if (varKey === 'bgImage') return; 
        
        settings[varKey] = themeInput.value;
        // Ручная правка любой телефонной настройки снимает наследование темы
        // HUD — иначе следующий applyThemeColors затёр бы правку обратно.
        const PHONE_KEYS = /^(phoneBg(Start|End|Alpha)|phoneAccent|phoneBlur|phoneBubbleRadius|phoneFont(Size)?|phoneNotifAlpha|msgIn(Bg|Alpha)|msgOut(Start|End|Alpha))$/;
        if (PHONE_KEYS.test(varKey) && settings.phoneThemeAuto !== false) {
          settings.phoneThemeAuto = false;
          document.querySelectorAll('.hud-phone-theme-auto').forEach(box => { box.checked = false; });
        }

        
        applyThemeColors(); 
        saveSettings();     
        
        let displayVal = themeInput.nextElementSibling;
        if (displayVal && displayVal.tagName === 'SPAN') {
            displayVal.textContent = themeInput.value + 'px';
        }
        
        document.querySelectorAll(`[data-key="${varKey}"]`).forEach(inp => {
            if (inp !== themeInput) inp.value = themeInput.value;
        });
    }
  });

}

export function initObserver(ctx, chatContainer) {
  const { safeProcessMessage, isPerformanceModeActive, refreshPerformanceMessageClasses,
          schedulePerformanceRefresh, getPerformanceObserver } = ctx;
  if (observer) {
    observer.disconnect();
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
    if (avatarChanged) invalidateAvatarCache();

    // Не запускаем processMessage десятки раз подряд
    // на одной пачке DOM-изменений.
    requestAnimationFrame(() => {
      const performanceActive = isPerformanceModeActive(chatContainer);
      touchedMessages.forEach(mes => {
        if (!mes.isConnected) return;
        // В Performance Mode старые сообщения не гоняем через полный процессор на каждую
        // внутреннюю мутацию. IntersectionObserver обработает их, когда они приблизятся к экрану.
        if (performanceActive && mes.classList.contains('hud-perf-older') && !mes.classList.contains('hud-perf-visible')) return;
        safeProcessMessage(mes);
      });
      if (performanceActive) refreshPerformanceMessageClasses();
      schedulePerformanceRefresh();
    });
  });

  observer.observe(chatContainer, {
    childList: true,
    subtree: true,
    characterData: true,
    characterDataOldValue: false
  });
}

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

      mes.removeAttribute('data-hud-processed');
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
