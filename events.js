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

import { invalidateAvatarCache } from './avatars.js?v=22.7.1';
import { applyRelGraphFocus, setRelGraphExpandedState } from './render/relations-graph.js?v=22.7.1';

// Приватен для модуля: initObserver — единственное место создания.
let observer = null;

export function initGlobalEvents(ctx) {
  const { settings, saveSettings, applyThemeColors, showHudToast, getWorldVotes } = ctx;
  if (window.hudEventsInitialized) return;
  window.hudEventsInitialized = true;

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
      } else {
        view.classList.remove('is-chat-open');
      }
    };

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
    const chatRow = e.target.closest('.hud-phone-chat-row, .hud-phone-notif');
    if (chatRow && chatRow.dataset.chatTarget) {
      e.preventDefault();
      const emulator = chatRow.closest('.hud-phone-emulator');
      const stack = chatRow.closest('.hud-phone-notif-stack');
      let view = chatRow.closest('.hud-phone-app-view');
      if (emulator && stack) {
        const appId = stack.dataset.phoneApp;
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
      relGraph.classList.toggle('fx-active', true);
      setRelGraphExpandedState(relGraph, true);

      if (!relGraph.dataset.relZoomBound) {
        relGraph.dataset.relZoomBound = '1';
        relGraph.addEventListener('wheel', (wheelEvent) => {
          if (!relGraph.classList.contains('is-expanded')) return;
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
