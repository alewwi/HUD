// hud-manager/render/archive.js
//
// Окно «Архив HUD»: выбор диапазона сообщений, запуск анализа и показ отчёта.
//
// Считает не этот модуль, а history-analyzer.js — здесь только интерфейс.
// Отчёт приходит готовым объектом, поэтому окно одинаково рисует и свежий
// расчёт, и поднятый из кэша.

import { escapeHtml, guardTouchSwipe } from '../utils.js?v=22.98.0';
import { analyzeChat, getChatMessages, readCache, writeCache } from '../history-analyzer.js?v=22.98.0';

let окноОткрыто = false;

// Ссылка на сообщение: по клику чат прокручивается к нему и оно мигает.
// Номер — это индекс в чате, тот же, что показывает ST.
const ссылка = (at) => `<button type="button" class="hud-arc-ref" data-mes="${at}" title="Перейти к сообщению">#${at}</button>`;

const ЯРЛЫКИ_СТАТУСА = {
  unknown: 'никто не знает', suspected: 'подозревают', partial: 'знают частично',
  known: 'знают', revealed: 'раскрыт', rumor: 'слухи', hidden: 'скрыт',
};
const статус = (s) => ЯРЛЫКИ_СТАТУСА[String(s || '').toLowerCase()] || String(s || '');

const ЯРЛЫКИ_УРОВНЯ = { low: 'низкий', medium: 'средний', high: 'высокий', critical: 'критический' };

// --- Вкладки отчёта ----------------------------------------------------------

function вкладкаСекретов(отчёт, поиск) {
  const список = отчёт.secrets.filter(s => !поиск || (
    s.fact.toLowerCase().includes(поиск) ||
    s.knows.some(k => k.name.toLowerCase().includes(поиск)) ||
    s.unaware.some(n => n.toLowerCase().includes(поиск))));
  if (!список.length) return `<div class="hud-arc-empty">${поиск ? 'По запросу ничего не нашлось' : 'В этом отрезке секретов не было'}</div>`;

  return список.map(s => {
    const путь = s.statusHistory.map(h => `<span class="hud-arc-status">${escapeHtml(статус(h.status))} ${ссылка(h.at)}</span>`).join('<i>→</i>');
    const знают = s.knows.length
      ? s.knows.map(k => `<span class="hud-arc-who">${escapeHtml(k.name)}${k.source ? ` <em>${escapeHtml(k.source)}</em>` : ''} <small>с ${ссылка(k.since)}</small></span>`).join('')
      : '<span class="hud-arc-who is-none">никто</span>';
    const неЗнают = s.unaware.length
      ? s.unaware.map(n => `<span class="hud-arc-who is-out">${escapeHtml(n)}</span>`).join('')
      : '';
    const уровень = s.level ? (ЯРЛЫКИ_УРОВНЯ[s.level] || s.level) : '';
    return `<div class="hud-arc-card">
      <div class="hud-arc-card-head">🔒 <b>${escapeHtml(s.fact)}</b>${уровень ? `<span class="hud-arc-tag">${escapeHtml(уровень)}</span>` : ''}</div>
      <div class="hud-arc-row"><label>Статус</label><div class="hud-arc-path">${путь}</div></div>
      <div class="hud-arc-row"><label>Знают</label><div>${знают}</div></div>
      ${неЗнают ? `<div class="hud-arc-row"><label>Не знают</label><div>${неЗнают}</div></div>` : ''}
      <div class="hud-arc-foot">появился в ${ссылка(s.firstSeen)}, последнее упоминание ${ссылка(s.lastSeen)}</div>
    </div>`;
  }).join('');
}

function вкладкаОтношений(отчёт, поиск) {
  const имена = Object.keys(отчёт.relations);
  if (!имена.length) return '<div class="hud-arc-empty">В этом отрезке отношения не менялись</div>';
  const куски = [];
  for (const субъект of имена) {
    const цели = отчёт.relations[субъект];
    const строки = Object.keys(цели).filter(цель => !поиск ||
      субъект.toLowerCase().includes(поиск) || цель.toLowerCase().includes(поиск) ||
      цели[цель].some(c => c.rel.toLowerCase().includes(поиск)));
    if (!строки.length) continue;
    куски.push(`<div class="hud-arc-card">
      <div class="hud-arc-card-head">👤 <b>${escapeHtml(субъект)}</b></div>
      ${строки.map(цель => {
        const путь = цели[цель].map(c => `<span class="hud-arc-status">${escapeHtml(c.rel)} ${ссылка(c.at)}</span>`).join('<i>→</i>');
        const менялось = цели[цель].length > 1 ? `<span class="hud-arc-tag">${цели[цель].length - 1} смен${цели[цель].length - 1 === 1 ? 'а' : ''}</span>` : '';
        return `<div class="hud-arc-row"><label>→ ${escapeHtml(цель)}</label><div class="hud-arc-path">${путь}${менялось}</div></div>`;
      }).join('')}
    </div>`);
  }
  return куски.length ? куски.join('') : '<div class="hud-arc-empty">По запросу ничего не нашлось</div>';
}

function вкладкаХронологии(отчёт, поиск) {
  // Даты и локации — один поток событий: так видно, что переезд случился
  // в тот же вечер, а не «когда-то между».
  const события = [
    ...отчёт.dates.map(d => ({ at: d.at, kind: 'date', text: d.date + (d.time ? `, ${d.time}` : '') })),
    ...отчёт.locations.map(l => ({ at: l.at, kind: 'place', text: l.place })),
  ].filter(e => !поиск || e.text.toLowerCase().includes(поиск))
   .sort((a, b) => a.at - b.at || (a.kind === 'date' ? -1 : 1));

  if (!события.length) return `<div class="hud-arc-empty">${поиск ? 'По запросу ничего не нашлось' : 'В этом отрезке сцена не менялась'}</div>`;

  const дней = отчёт.stats.storyDays;
  const шапка = `<div class="hud-arc-note">${дней === null
    ? 'Длительность сюжета посчитать не вышло: даты в HUD записаны в свободной форме.'
    : `В сюжете прошло <b>${дней}</b> ${дней === 1 ? 'день' : (дней < 5 ? 'дня' : 'дней')} — по датам из HUD.`}</div>`;

  return шапка + '<div class="hud-arc-timeline">' + события.map(e => `
    <div class="hud-arc-event is-${e.kind}">
      <span class="hud-arc-dot"></span>
      <span class="hud-arc-when">${e.kind === 'date' ? '📅' : '📍'} ${escapeHtml(e.text)}</span>
      ${ссылка(e.at)}
    </div>`).join('') + '</div>';
}

function вкладкаСтатистики(отчёт) {
  const s = отчёт.stats;
  const плитка = (значение, подпись, пояснение) => `<div class="hud-arc-tile">
    <b>${escapeHtml(String(значение))}</b><span>${escapeHtml(подпись)}</span>
    ${пояснение ? `<small>${escapeHtml(пояснение)}</small>` : ''}</div>`;

  const доля = s.totalMessages ? Math.round(s.withHud / s.totalMessages * 100) : 0;
  const плитки = [
    плитка(s.totalMessages, 'сообщений в отрезке'),
    плитка(s.withHud, 'из них с HUD', доля + '% отрезка'),
    плитка(s.brokenHud, 'битых блоков', s.brokenHud ? 'разобрать не удалось' : 'все разобрались'),
    плитка(s.uniqueCharacters, 'персонажей'),
    плитка(s.storyDays === null ? '—' : s.storyDays, 'дней в сюжете', s.storyDays === null ? 'даты не разобрались' : ''),
    плитка(s.uniqueLocations, 'локаций', s.locationChanges + ' переходов'),
    плитка(s.moodChanges, 'смен настроения'),
    плитка(s.secretsTotal, 'секретов', s.secretsRevealedToSomeone + ' хоть кому-то известны'),
    плитка(s.relationPairs, 'пар в отношениях'),
  ].join('');

  const погода = s.weather.length
    ? `<div class="hud-arc-card"><div class="hud-arc-card-head">🌦 Погода</div>
        <div class="hud-arc-row"><div>${s.weather.map(w => `<span class="hud-arc-who">${escapeHtml(w.kind)} <small>×${w.times}</small></span>`).join('')}</div></div></div>`
    : '';

  const люди = s.characters.length
    ? `<div class="hud-arc-card"><div class="hud-arc-card-head">🎭 Кто встречался</div>
        <div class="hud-arc-row"><div>${s.characters.map(n => `<span class="hud-arc-who">${escapeHtml(n)}</span>`).join('')}</div></div></div>`
    : '';

  const настроения = отчёт.moods.length
    ? `<div class="hud-arc-card"><div class="hud-arc-card-head">🎚 Настроение по персонажам</div>
        ${отчёт.moods.slice(0, 8).map(m => `<div class="hud-arc-row"><label>${escapeHtml(m.name)}</label>
          <div class="hud-arc-path">${m.changes.slice(-6).map(c => `<span class="hud-arc-status">${escapeHtml(c.mood)} ${ссылка(c.at)}</span>`).join('<i>→</i>')}
          ${m.changes.length > 6 ? `<span class="hud-arc-tag">всего ${m.changes.length}</span>` : ''}</div></div>`).join('')}
      </div>`
    : '';

  return `<div class="hud-arc-tiles">${плитки}</div>${люди}${настроения}${погода}`;
}

// --- Окно --------------------------------------------------------------------

export function openArchiveDialog() {
  if (окноОткрыто) return;
  const chat = getChatMessages();
  if (!chat.length) {
    alert('Чат пуст — анализировать нечего.');
    return;
  }
  окноОткрыто = true;

  const последний = chat.length - 1;
  const начало = Math.max(0, последний - 199); // по умолчанию — последние 200 ходов

  const overlay = document.createElement('div');
  overlay.className = 'hud-modal-overlay hud-arc-overlay';
  overlay.innerHTML = `
    <div class="hud-modal hud-arc-modal" role="dialog" aria-modal="true" aria-label="Архив HUD">
      <div class="hud-modal-head">🗄 Архив HUD <small>сводка по сохранённым HUD-блокам</small></div>
      <div class="hud-arc-controls">
        <div class="hud-arc-range">
          <label>с <input type="number" class="hud-arc-from" min="0" max="${последний}" value="${начало}"></label>
          <label>по <input type="number" class="hud-arc-to" min="0" max="${последний}" value="${последний}"></label>
          <span class="hud-arc-total">всего ${chat.length} сообщ.</span>
        </div>
        <div class="hud-arc-sliders">
          <input type="range" class="hud-arc-slide-from" min="0" max="${последний}" value="${начало}">
          <input type="range" class="hud-arc-slide-to" min="0" max="${последний}" value="${последний}">
        </div>
        <div class="hud-arc-quick">
          <button type="button" data-quick="all">весь чат</button>
          <button type="button" data-quick="50">последние 50</button>
          <button type="button" data-quick="200">последние 200</button>
          <button type="button" class="hud-arc-run">Анализировать</button>
        </div>
        <div class="hud-arc-progress" hidden><div class="hud-arc-bar"></div><span></span></div>
      </div>
      <div class="hud-arc-tabs" hidden>
        <button type="button" class="active" data-tab="secrets">Секреты</button>
        <button type="button" data-tab="relations">Отношения</button>
        <button type="button" data-tab="timeline">Хронология</button>
        <button type="button" data-tab="stats">Статистика</button>
        <input type="search" class="hud-arc-search" placeholder="Поиск по отчёту…">
      </div>
      <div class="hud-modal-body hud-arc-body"><div class="hud-arc-empty">Выберите диапазон и нажмите «Анализировать».</div></div>
      <div class="hud-modal-foot">
        <span class="hud-arc-meta"></span>
        <button type="button" class="hud-modal-btn hud-arc-export" disabled>Экспорт JSON</button>
        <button type="button" class="hud-modal-btn cancel">Закрыть</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  guardTouchSwipe(overlay);

  const $ = (s) => overlay.querySelector(s);
  const тело = $('.hud-arc-body');
  const вкладки = $('.hud-arc-tabs');
  const прогресс = $('.hud-arc-progress');

  let отчёт = null;
  let активная = 'secrets';
  let идётАнализ = false;
  let отменено = false;

  const закрыть = () => { отменено = true; окноОткрыто = false; overlay.remove(); document.removeEventListener('keydown', поКлавише); };
  const поКлавише = (e) => { if (e.key === 'Escape') закрыть(); };
  document.addEventListener('keydown', поКлавише);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) закрыть(); });
  $('.cancel').addEventListener('click', закрыть);

  // --- Диапазон ---
  const поля = { from: $('.hud-arc-from'), to: $('.hud-arc-to'), sFrom: $('.hud-arc-slide-from'), sTo: $('.hud-arc-slide-to') };
  // Пустое поле заменяем краем чата, но ноль — это выбор пользователя, а не
  // пустота: через `|| последний` конец диапазона нельзя было поставить на
  // самое первое сообщение.
  const число = (поле, поумолчанию) => {
    const v = parseInt(поле.value, 10);
    return Number.isNaN(v) ? поумолчанию : Math.max(0, Math.min(последний, v));
  };
  const диапазон = () => {
    let a = число(поля.from, 0);
    let b = число(поля.to, последний);
    if (b < a) [a, b] = [b, a];
    return [a, b];
  };
  const синхронизировать = (изПолзунка) => {
    if (изПолзунка) { поля.from.value = поля.sFrom.value; поля.to.value = поля.sTo.value; }
    const [a, b] = диапазон();
    поля.from.value = a; поля.to.value = b; поля.sFrom.value = a; поля.sTo.value = b;
    $('.hud-arc-total').textContent = `выбрано ${b - a + 1} из ${chat.length}`;
  };
  ['input', 'change'].forEach(ev => {
    поля.from.addEventListener(ev, () => синхронизировать(false));
    поля.to.addEventListener(ev, () => синхронизировать(false));
    поля.sFrom.addEventListener(ev, () => синхронизировать(true));
    поля.sTo.addEventListener(ev, () => синхронизировать(true));
  });
  overlay.querySelectorAll('[data-quick]').forEach(b => b.addEventListener('click', () => {
    const q = b.dataset.quick;
    поля.to.value = последний;
    поля.from.value = q === 'all' ? 0 : Math.max(0, последний - (parseInt(q, 10) - 1));
    синхронизировать(false);
  }));
  синхронизировать(false);

  // --- Показ отчёта ---
  const показать = () => {
    if (!отчёт) return;
    const поиск = ($('.hud-arc-search').value || '').trim().toLowerCase();
    вкладки.hidden = false;
    тело.innerHTML =
      активная === 'secrets' ? вкладкаСекретов(отчёт, поиск)
      : активная === 'relations' ? вкладкаОтношений(отчёт, поиск)
      : активная === 'timeline' ? вкладкаХронологии(отчёт, поиск)
      : вкладкаСтатистики(отчёт);
    тело.scrollTop = 0;
  };
  вкладки.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
    вкладки.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x === b));
    активная = b.dataset.tab;
    показать();
  }));
  $('.hud-arc-search').addEventListener('input', показать);

  // Клик по номеру сообщения — прокрутка к нему в чате.
  тело.addEventListener('click', (e) => {
    const btn = e.target.closest('.hud-arc-ref');
    if (!btn) return;
    const el = document.querySelector(`#chat .mes[mesid="${btn.dataset.mes}"]`);
    if (!el) { btn.classList.add('is-missing'); setTimeout(() => btn.classList.remove('is-missing'), 900); return; }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('hud-arc-flash');
    setTimeout(() => el.classList.remove('hud-arc-flash'), 1600);
  });

  // --- Запуск ---
  const мета = $('.hud-arc-meta');
  const запустить = async (изКэша) => {
    if (идётАнализ) return;
    const [a, b] = диапазон();

    if (изКэша !== false) {
      const кэш = await readCache(a, b);
      if (кэш && !кэш.stale) {
        отчёт = кэш.report;
        мета.innerHTML = `из кэша от ${new Date(кэш.savedAt).toLocaleString()} · <button type="button" class="hud-arc-again">пересчитать</button>`;
        мета.querySelector('.hud-arc-again').addEventListener('click', () => запустить(false));
        $('.hud-arc-export').disabled = false;
        показать();
        return;
      }
    }

    идётАнализ = true;
    прогресс.hidden = false;
    $('.hud-arc-run').disabled = true;
    тело.innerHTML = '<div class="hud-arc-empty">Разбираю сообщения…</div>';
    const полоса = прогресс.querySelector('.hud-arc-bar');
    const подпись = прогресс.querySelector('span');

    try {
      отчёт = await analyzeChat(a, b, {
        shouldStop: () => отменено,
        onProgress: (готово, всего) => {
          const pct = Math.round(готово / всего * 100);
          полоса.style.width = pct + '%';
          подпись.textContent = `${готово} из ${всего}`;
        },
      });
    } catch (e) {
      console.error('[TavernOS HUD] Архив: анализ не удался', e);
      тело.innerHTML = `<div class="hud-arc-empty">Не получилось разобрать чат: ${escapeHtml(String(e && e.message || e))}</div>`;
      идётАнализ = false; прогресс.hidden = true; $('.hud-arc-run').disabled = false;
      return;
    }
    идётАнализ = false;
    прогресс.hidden = true;
    $('.hud-arc-run').disabled = false;
    if (!отчёт) return; // окно закрыли во время разбора

    const сохранён = await writeCache(a, b, отчёт);
    мета.textContent = `сообщений с HUD: ${отчёт.stats.withHud} из ${отчёт.stats.totalMessages}`
      + (отчёт.stats.brokenHud ? ` · битых: ${отчёт.stats.brokenHud}` : '')
      + (сохранён ? '' : ' · кэш не поместился');
    $('.hud-arc-export').disabled = false;
    показать();
  };
  $('.hud-arc-run').addEventListener('click', () => запустить(true));

  // --- Экспорт ---
  $('.hud-arc-export').addEventListener('click', () => {
    if (!отчёт) return;
    const blob = new Blob([JSON.stringify(отчёт, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hud-архив-${отчёт.range.from}-${отчёт.range.to}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}
