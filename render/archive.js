// hud-manager/render/archive.js
//
// Окно «Архив HUD»: выбор диапазона сообщений, запуск анализа и показ отчёта.
//
// Считает не этот модуль, а history-analyzer.js — здесь только интерфейс.
// Отчёт приходит готовым объектом, поэтому окно одинаково рисует и свежий
// расчёт, и поднятый из кэша.

import { escapeHtml, guardTouchSwipe } from '../utils.js?v=22.99.76';
import { analyzeChat, getChatMessages, readCache, writeCache } from '../history-analyzer.js?v=22.99.76';

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

const ЯРЛЫКИ_РУЖЬЯ = { open: '🔫 висит', building: '⏳ назревает', fired: '💥 выстрелило' };

function вкладкаРужей(отчёт, поиск) {
  if (!Array.isArray(отчёт.guns)) return '<div class="hud-arc-empty">Этот отчёт посчитан до появления ружей — нажмите «пересчитать».</div>';
  const список = отчёт.guns.filter(g => !поиск || g.setup.toLowerCase().includes(поиск) || String(g.tiedTo || '').toLowerCase().includes(поиск));
  if (!список.length) return `<div class="hud-arc-empty">${поиск ? 'По запросу ничего не нашлось' : 'В этом отрезке ружей не было'}</div>`;
  const открытых = список.filter(g => (g.statusHistory[g.statusHistory.length - 1] || {}).status !== 'fired').length;
  const шапка = `<div class="hud-arc-note">Незакрытых нитей: <b>${открытых}</b> из ${список.length}. Выстрелившие остаются здесь вместе с моментом, когда это случилось.</div>`;
  return шапка + список.map(g => {
    const путь = g.statusHistory.map(h => `<span class="hud-arc-status">${escapeHtml(ЯРЛЫКИ_РУЖЬЯ[h.status] || h.status)} ${ссылка(h.at)}</span>`).join('<i>→</i>');
    const выстрел = g.statusHistory.find(h => h.status === 'fired');
    return `<div class="hud-arc-card">
      <div class="hud-arc-card-head">🔫 <b>${escapeHtml(g.setup)}</b>${выстрел ? '<span class="hud-arc-tag">выстрелило</span>' : ''}</div>
      ${g.tiedTo ? `<div class="hud-arc-row"><label>Связано с</label><div><span class="hud-arc-who">${escapeHtml(g.tiedTo)}</span></div></div>` : ''}
      <div class="hud-arc-row"><label>Статус</label><div class="hud-arc-path">${путь}</div></div>
      <div class="hud-arc-foot">появилось в ${ссылка(g.firstSeen)}, последнее упоминание ${ссылка(g.lastSeen)}</div>
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
    плитка(s.gunsTotal ?? '—', 'ружей Чехова', s.gunsTotal ? `${s.gunsFired} выстрелило` : ''),
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

// --- Дашборд ------------------------------------------------------------------
// Виджеты выбираются галочками; выбор живёт в localStorage и одинаков для всех
// чатов. Цвета — по одному на смысл: серия одна — цвет один.

const ВИДЖЕТЫ = [
  ['health', '🩺', 'Здоровье чата'],
  ['speakers', '🗣', 'Кто чаще говорит'],
  ['heatmap', '🕰', 'Активность по времени сцены'],
  ['words', '🔤', 'Топ-10 слов и фраз'],
  ['length', '📏', 'Длина ответов модели'],
  ['engagement', '🔁', 'Вовлечённость'],
  ['boring', '🥱', 'Скучные зоны'],
  ['scenes', '🎬', 'Ритм сцен'],
  ['dialogue', '💬', 'Диалог и описание'],
  ['nsfw', '🔞', 'Частота NSFW-сцен'],
  ['mentions', '🕸', 'Кто кого упоминает'],
];
const КЛЮЧ_ВИДЖЕТОВ = 'hud_archive_widgets';
function выборВиджетов() {
  try {
    const v = JSON.parse(localStorage.getItem(КЛЮЧ_ВИДЖЕТОВ) || 'null');
    if (v && typeof v === 'object') return v;
  } catch (_) {}
  return {};
}
function запомнитьВиджет(id, включён) {
  const v = выборВиджетов();
  v[id] = !!включён;
  try { localStorage.setItem(КЛЮЧ_ВИДЖЕТОВ, JSON.stringify(v)); } catch (_) {}
}

const число = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('ru-RU'));
const плитка = (значение, подпись, пояснение) => `<div class="hud-arc-tile"><b>${escapeHtml(String(значение))}</b><span>${escapeHtml(подпись)}</span>${пояснение ? `<small>${escapeHtml(пояснение)}</small>` : ''}</div>`;
const полоса = (подпись, доля, значение, пояснение) => `<div class="hud-dash-bar"${пояснение ? ` title="${escapeHtml(пояснение)}"` : ''}>`
  + `<span class="hud-dash-bar-label">${подпись}</span>`
  + `<span class="hud-dash-bar-track"><i style="width:${Math.max(0, Math.min(100, доля)).toFixed(1)}%"></i></span>`
  + `<span class="hud-dash-bar-val">${escapeHtml(значение)}</span></div>`;
const склон = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };

// Последовательная шкала синего: слабое уходит в фон, сильное светлеет.
const ШКАЛА = ['#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#86b6ef'];

const РИСУНКИ = {
  health(д) {
    const h = д.health;
    return `<div class="hud-arc-tiles">`
      + плитка(число(h.messages), 'сообщений', `вы ${число(h.user)} · модель ${число(h.ai)}`)
      + плитка(число(h.avgChars), 'знаков в среднем', `≈ ${число(h.avgWords)} слов`)
      + плитка(h.perDay === null ? '—' : число(h.perDay), 'сообщений в день', h.days ? `за ${число(h.days)} ${склон(h.days, 'день', 'дня', 'дней')}` : 'нет дат отправки')
      + плитка(h.medianGapMin === null ? '—' : число(h.medianGapMin) + ' мин', 'обычная пауза', 'медиана между сообщениями')
      + плитка(число(h.sessions), склон(h.sessions, 'сессия', 'сессии', 'сессий'), 'перерыв больше двух часов — новая')
      + `</div>`;
  },
  speakers(д) {
    if (!д.speakers.length) return '';
    const максимум = Math.max(...д.speakers.map(s => s.share)) || 1;
    return `<div class="hud-dash-bars">` + д.speakers.map(s => полоса(
      escapeHtml(s.name) + (s.isUser ? ' <em>вы</em>' : ''), s.share / максимум * 100,
      `${число(s.share)}% · ${число(s.count)}`, `${s.name}: ${s.count} сообщений, ${s.share}%`)).join('') + `</div>`;
  },
  heatmap(д) {
    const { hours, total } = д.heatmap;
    if (!total) return '<div class="hud-arc-note">В HUD этого отрезка не записано время сцены.</div>';
    const максимум = Math.max(...hours) || 1;
    const клетки = hours.map((n, h) => {
      const цвет = n ? ШКАЛА[Math.min(ШКАЛА.length - 1, Math.floor(n / максимум * (ШКАЛА.length - 1) + 0.0001))] : '';
      const подсказка = `${String(h).padStart(2, '0')}:00–${String(h).padStart(2, '0')}:59 — ${n} ${склон(n, 'ход', 'хода', 'ходов')}`;
      return `<span class="hud-dash-cell${n ? '' : ' is-zero'}" style="${цвет ? `background:${цвет}` : ''}" title="${подсказка}" aria-label="${подсказка}"></span>`;
    }).join('');
    const пик = hours.indexOf(максимум);
    return `<div class="hud-dash-heat">${клетки}</div>`
      + `<div class="hud-dash-heat-axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>`
      + `<div class="hud-dash-foot">Чаще всего действие идёт с ${String(пик).padStart(2, '0')}:00 — ${максимум} ${склон(максимум, 'ход', 'хода', 'ходов')}. <span class="hud-dash-ramp">${ШКАЛА.map(c => `<i style="background:${c}"></i>`).join('')}</span> меньше → больше</div>`;
  },
  words(д) {
    if (!д.words.length) return '';
    const максС = д.words[0].count || 1;
    const слова = д.words.map(w => полоса(escapeHtml(w.word), w.count / максС * 100, число(w.count))).join('');
    const максФ = д.phrases.length ? д.phrases[0].count : 1;
    const фразы = д.phrases.length ? д.phrases.map(p => полоса(escapeHtml(p.phrase), p.count / максФ * 100, число(p.count))).join('') : '<div class="hud-arc-empty">Повторяющихся фраз нет</div>';
    return `<div class="hud-dash-cols"><div><div class="hud-dash-sub">Слова</div><div class="hud-dash-bars">${слова}</div></div><div><div class="hud-dash-sub">Фразы</div><div class="hud-dash-bars">${фразы}</div></div></div>`;
  },
  length(д) {
    const { points, firstAvg, lastAvg, changePct } = д.length;
    if (points.length < 2) return '<div class="hud-arc-note">Ответов модели слишком мало для графика.</div>';
    const W = 320, H = 120, Л = 36, П = 10, В = 10, Н = 20;
    const максимум = Math.max(...points.map(p => p.len)) || 1;
    const x = (i) => Л + (W - Л - П) * i / (points.length - 1);
    const y = (v) => В + (H - В - Н) * (1 - v / максимум);
    const линия = points.map((p, i) => `${x(i).toFixed(1)},${y(p.len).toFixed(1)}`).join(' ');
    const сетка = [0, 0.5, 1].map(k => `<line class="hud-dash-grid" x1="${Л}" x2="${W - П}" y1="${y(максимум * k).toFixed(1)}" y2="${y(максимум * k).toFixed(1)}"/><text class="hud-dash-tick" x="${Л - 5}" y="${(y(максимум * k) + 3).toFixed(1)}" text-anchor="end">${Math.round(максимум * k)}</text>`).join('');
    const точки = points.map((p, i) => `<circle class="hud-dash-hit" cx="${x(i).toFixed(1)}" cy="${y(p.len).toFixed(1)}" r="9"><title>#${p.at}: ${p.len} знаков</title></circle>`).join('');
    const последняя = points[points.length - 1];
    const вывод = changePct === null ? 'Для сравнения нужно больше ответов.'
      : Math.abs(changePct) < 10 ? `Длина держится: ${число(firstAvg)} → ${число(lastAvg)} знаков в среднем.`
      : changePct < 0 ? `Модель стала писать короче на ${Math.abs(changePct)}%: ${число(firstAvg)} → ${число(lastAvg)} знаков в среднем.`
      : `Модель стала писать длиннее на ${changePct}%: ${число(firstAvg)} → ${число(lastAvg)} знаков в среднем.`;
    return `<svg class="hud-dash-line" viewBox="0 0 ${W} ${H}" role="img" aria-label="Длина ответов модели по ходу чата">${сетка}`
      + `<polyline class="hud-dash-series" points="${линия}"/>`
      + `<circle class="hud-dash-end" cx="${x(points.length - 1).toFixed(1)}" cy="${y(последняя.len).toFixed(1)}" r="4"/>`
      + `<text class="hud-dash-endlabel" x="${(x(points.length - 1) - 6).toFixed(1)}" y="${(y(последняя.len) - 8).toFixed(1)}" text-anchor="end">${последняя.len}</text>`
      + `<text class="hud-dash-tick" x="${Л}" y="${H - 5}">#${points[0].at}</text><text class="hud-dash-tick" x="${W - П}" y="${H - 5}" text-anchor="end">#${последняя.at}</text>`
      + `${точки}</svg><div class="hud-dash-foot">${escapeHtml(вывод)}</div>`;
  },
  engagement(д) {
    const e = д.engagement;
    const доля = e.aiMessages ? Math.round(e.swiped / e.aiMessages * 100) : 0;
    const список = e.top.length
      ? `<div class="hud-arc-row"><label>Чаще свайпали</label><div>${e.top.map(t => `<span class="hud-arc-who">${ссылка(t.at)} <small>×${t.swipes}</small></span>`).join('')}</div></div>` : '';
    return `<div class="hud-arc-tiles">`
      + плитка(число(e.swiped), 'ответов со свайпами', `${доля}% из ${число(e.aiMessages)}`)
      + плитка(число(e.extraSwipes), 'лишних вариантов', e.aiMessages ? `≈ ${число(Math.round(e.extraSwipes / e.aiMessages * 10) / 10)} на ответ` : '')
      + `</div>${список}<div class="hud-dash-foot">Правки текста SillyTavern не запоминает — считаются только свайпы.</div>`;
  },
  boring(д) {
    const b = д.boring;
    if (b.avgSimilarity === null) return '<div class="hud-arc-note">Ответов модели слишком мало для сравнения.</div>';
    const зоны = b.zones.length
      ? `<div class="hud-dash-bars">${b.zones.map(z => полоса(`${ссылка(z.prev)} → ${ссылка(z.at)}${z.phrase ? ` <em>«${escapeHtml(z.phrase)}…»</em>` : ''}`, z.similarity, z.similarity + '%', `Совпадает ${z.similarity}% троек слов с прошлым ответом`)).join('')}</div>`
      : '<div class="hud-arc-empty">Заметных повторов нет</div>';
    return `<div class="hud-arc-tiles">${плитка(b.avgSimilarity + '%', 'среднее совпадение', 'соседних ответов модели')}</div>${зоны}`
      + `<div class="hud-dash-foot">Считаются общие тройки слов у соседних ответов модели. От 12% — зона повтора.</div>`;
  },
  scenes(д) {
    const s = д.scenes;
    if (!s.count) return '<div class="hud-arc-note">В HUD этого отрезка нет мест — сцены не разделить.</div>';
    const максимум = Math.max(...s.list.map(x => x.turns)) || 1;
    const длиннее = s.longest;
    return `<div class="hud-arc-tiles">`
      + плитка(число(s.count), склон(s.count, 'сцена', 'сцены', 'сцен'))
      + плитка(число(s.avgTurns), 'ходов на сцену')
      + (длиннее ? плитка(число(длиннее.turns), 'ходов в самой долгой', длиннее.place) : '')
      + `</div><div class="hud-dash-bars">${s.list.map(x => полоса(`${escapeHtml(x.place.length > 30 ? x.place.slice(0, 29) + '…' : x.place)} ${ссылка(x.from)}`, x.turns / максимум * 100,
        `${x.turns} ${склон(x.turns, 'ход', 'хода', 'ходов')}${x.minutes !== null ? ' · ' + x.minutes + ' мин' : ''}`)).join('')}</div>`;
  },
  dialogue(д) {
    const { share, dialogueChars, descriptionChars } = д.dialogue;
    if (share === null) return '';
    return `<div class="hud-dash-split" role="img" aria-label="Диалог ${share}%, описание ${100 - share}%">`
      + `<i class="is-dialogue" style="flex:${Math.max(share, 0.5)}" title="Диалог: ${share}%"></i>`
      + `<i class="is-description" style="flex:${Math.max(100 - share, 0.5)}" title="Описание: ${100 - share}%"></i></div>`
      + `<div class="hud-dash-legend"><span><i class="is-dialogue"></i>Диалог ${share}% · ${число(dialogueChars)} знаков</span>`
      + `<span><i class="is-description"></i>Описание ${100 - share}% · ${число(descriptionChars)} знаков</span></div>`
      + `<div class="hud-dash-foot">Диалог — текст в кавычках и реплики через тире в ответах модели.</div>`;
  },
  nsfw(д) {
    const n = д.nsfw;
    if (!n.nsfwTurns) return '';
    return `<div class="hud-arc-tiles">`
      + плитка(n.share + '%', 'ходов с близостью', `${число(n.nsfwTurns)} из ${число(n.hudTurns)} с HUD`)
      + плитка(число(n.scenes), склон(n.scenes, 'сцена', 'сцены', 'сцен'), 'подряд идущие ходы — одна')
      + `</div>`;
  },
  mentions(д) {
    if (!д.mentions.length) return '';
    const максимум = д.mentions[0].count || 1;
    return `<div class="hud-dash-bars">${д.mentions.map(m => полоса(`${escapeHtml(m.from)} <em>→</em> ${escapeHtml(m.to)}`, m.count / максимум * 100,
      `${число(m.count)} ${склон(m.count, 'сообщение', 'сообщения', 'сообщений')}`)).join('')}</div>`
      + `<div class="hud-dash-foot">Сколько сообщений одного говорящего называют другого по имени.</div>`;
  },
};

export function buildDashboardHTML(отчёт) {
  const д = отчёт && отчёт.dashboard;
  if (!д) return '<div class="hud-arc-empty">Этот отчёт посчитан до появления дашборда — нажмите «пересчитать».</div>';
  const выбор = выборВиджетов();
  const включён = (id) => выбор[id] !== false;
  const галочки = `<div class="hud-dash-pick" role="group" aria-label="Какие виджеты показывать">${ВИДЖЕТЫ.map(([id, значок, имя]) =>
    `<label class="hud-dash-chip${включён(id) ? ' is-on' : ''}"><input type="checkbox" data-widget="${id}"${включён(id) ? ' checked' : ''}> ${значок} ${escapeHtml(имя)}</label>`).join('')}</div>`;
  const карточки = ВИДЖЕТЫ.filter(([id]) => включён(id)).map(([id, значок, имя]) => {
    let тело = '';
    try { тело = РИСУНКИ[id](д); } catch (e) { console.warn('[TavernOS HUD] Дашборд: виджет не собрался', id, e); тело = ''; }
    return тело ? `<section class="hud-arc-card hud-dash-card" data-widget="${id}"><div class="hud-arc-card-head">${значок} <b>${escapeHtml(имя)}</b></div>${тело}</section>` : '';
  }).join('');
  return галочки + `<div class="hud-dash-grid">${карточки || '<div class="hud-arc-empty">Нечего показать: отметьте виджеты выше.</div>'}</div>`;
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
        <button type="button" data-tab="guns">Ружья</button>
        <button type="button" data-tab="relations">Отношения</button>
        <button type="button" data-tab="timeline">Хронология</button>
        <button type="button" data-tab="stats">Статистика</button>
        <button type="button" data-tab="dash">Дашборд</button>
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
      : активная === 'guns' ? вкладкаРужей(отчёт, поиск)
      : активная === 'relations' ? вкладкаОтношений(отчёт, поиск)
      : активная === 'timeline' ? вкладкаХронологии(отчёт, поиск)
      : активная === 'dash' ? buildDashboardHTML(отчёт)
      : вкладкаСтатистики(отчёт);
    тело.scrollTop = 0;
  };
  вкладки.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
    вкладки.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x === b));
    активная = b.dataset.tab;
    показать();
  }));
  $('.hud-arc-search').addEventListener('input', показать);
  тело.addEventListener('change', (e) => {
    const галочка = e.target.closest('.hud-dash-pick input[data-widget]');
    if (!галочка) return;
    const прокрутка = тело.scrollTop;
    запомнитьВиджет(галочка.dataset.widget, галочка.checked);
    показать();
    тело.scrollTop = прокрутка;
  });

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
