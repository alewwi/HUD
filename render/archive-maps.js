// hud-manager/render/archive-maps.js
//
// Три вкладки архива поверх сводок history-maps.js:
//  · Календарь настроения — у каждого сетка дней сюжета, клетка окрашена в
//    преобладающее за день настроение (цвета тем дневника): «чёрная неделя»
//    после ссоры видна сразу;
//  · Атлас мест — все места чата: визиты, кто бывает чаще, кто живёт или
//    работает, последний визит;
//  · Карта отношений — кто часто вместе, где растёт напряжение (доверие
//    падает), какие пары давно не пересекались.
//
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

import { escapeHtml } from '../utils.js?v=23.89.28';
import { ико } from './view-icons.js?v=23.89.28';
import { normalizeDiaryMood, ТЕМЫ_ДНЕВНИКА } from './diary.js?v=23.89.28';
import { parseSceneDate } from '../history-analyzer.js?v=23.89.28';

const значок = (имя) => ико(имя, 'hud-arc-ico');
const пусто = (текст) => `<div class="hud-arc-empty">${текст}</div>`;
const поиском = (поиск, ...строки) => !поиск || строки.some(s => String(s || '').toLowerCase().includes(поиск));
const ДЕНЬ = 864e5;

// --- Календарь настроения -------------------------------------------------------
function главноеНастроение(настроения) {
  const счёт = new Map();
  for (const н of настроения) { const к = normalizeDiaryMood(н); счёт.set(к, (счёт.get(к) || 0) + 1); }
  // Ровное — только если ничего другого за день не было.
  const ряд = [...счёт.entries()].sort((а, б) => (б[0] !== 'neutral') - (а[0] !== 'neutral') || б[1] - а[1]);
  return ряд.length ? ряд[0][0] : 'neutral';
}
export function вкладкаКалендаря(отчёт, поиск = '') {
  const люди = ((отчёт.maps && отчёт.maps.moodDays) || []).filter(л => поиском(поиск, л.name, ...л.days.flatMap(д => д.moods)));
  if (!люди.length) return пусто('Настроений за этот отрезок нет: их пишут трекер настроения и записи дневника.');
  const использовано = new Set();
  const ряды = люди.map(л => {
    // Дни по порядку сюжета; пропуск до недели — пустые клетки, чтобы неделя читалась
    // неделей. Пропуск длиннее — одна метка «N дн.»: день с перепутанной датой
    // растягивал сетку на сотни пустых клеток.
    const дни = л.days.map(д => ({ ...д, t: parseSceneDate(д.date) }));
    const сДатой = дни.filter(д => д.t !== null).sort((а, б) => а.t - б.t);
    const клетки = [];
    if (сДатой.length === дни.length && сДатой.length > 1) {
      let прошлый = null;
      for (const д of сДатой) {
        const k = Math.round(д.t / ДЕНЬ);
        const пропуск = прошлый === null ? 0 : k - прошлый - 1;
        if (пропуск > 7) клетки.push({ разрыв: пропуск });
        else for (let i = 0; i < пропуск; i++) клетки.push(null);
        клетки.push(д);
        прошлый = k;
      }
    } else клетки.push(...дни);
    return `<div class="hud-arc-mood-row"><b class="who">${escapeHtml(л.name)}</b><div class="hud-arc-mood-grid">${клетки.map(д => {
      if (!д) return '<i class="cell is-gap" title="нет записей"></i>';
      if (д.разрыв) return `<span class="cell-break" title="нет записей"><b>${д.разрыв}</b> <span>дн.</span></span>`;
      const к = главноеНастроение(д.moods);
      использовано.add(к);
      const имя = (ТЕМЫ_ДНЕВНИКА[к] || {}).имя || к;
      return `<i class="cell hud-diary-mood-${к}" title="${escapeHtml(д.date)} — ${escapeHtml(имя)}: ${escapeHtml([...new Set(д.moods)].slice(0, 4).join(', '))}"></i>`;
    }).join('')}</div></div>`;
  }).join('');
  const легенда = [...использовано].map(к => `<span class="hud-diary-mood-${к}"><i></i>${escapeHtml((ТЕМЫ_ДНЕВНИКА[к] || {}).имя || к)}</span>`).join('');
  return `<section class="hud-arc-card hud-arc-moodcal"><div class="hud-arc-card-head">${значок('calendar')} <b>Календарь настроения</b></div>`
    + `<p class="hud-arc-note">Клетка — день сюжета, цвет — настроение, которое за день преобладало. Наведите на клетку, чтобы увидеть дату и слова.</p>`
    + ряды + `<div class="hud-arc-mood-legend">${легенда}</div></section>`;
}

// --- Атлас мест -----------------------------------------------------------------------
export function вкладкаАтласа(отчёт, поиск = '') {
  const места = ((отчёт.maps && отчёт.maps.atlas) || []).filter(м => поиском(поиск, м.place, ...м.people.map(п => п.name)));
  if (!места.length) return пусто('Мест за этот отрезок нет: их пишет поле «Место» у персонажей.');
  const наибольшее = Math.max(...места.map(м => м.visits), 1);
  return `<section class="hud-arc-card hud-arc-atlas"><div class="hud-arc-card-head">${значок('pin')} <b>Атлас мест</b><span class="hud-arc-tag">${места.length}</span></div>`
    + места.map(м => `<div class="hud-arc-place"><div class="top"><b>${escapeHtml(м.place)}</b><span class="visits" style="--arc-v:${Math.round(м.visits / наибольшее * 100)}%"><i></i>${м.visits} ${склон(м.visits, 'визит', 'визита', 'визитов')}</span></div>`
      + `<div class="meta">${м.lastDate ? `<span>${значок('clock')} последний раз ${escapeHtml(м.lastDate)}</span>` : ''}${м.lives.length ? `<span class="lives">${значок('house')} живёт: ${escapeHtml(м.lives.join(', '))}</span>` : ''}${м.works.length ? `<span class="works">${значок('tool')} работает: ${escapeHtml(м.works.join(', '))}</span>` : ''}</div>`
      + (м.people.length ? `<div class="people">${м.people.map(п => `<span>${escapeHtml(п.name)} <small>${п.turns}</small></span>`).join('')}</div>` : '')
      + '</div>').join('') + '</section>';
}
const склон = (n, один, два, пять) => { const д = n % 100, е = n % 10; return д > 10 && д < 20 ? пять : е === 1 ? один : е >= 2 && е <= 4 ? два : пять; };

// --- Карта отношений --------------------------------------------------------------------
// Напряжение пары: насколько доверие упало от своего пика к последнему значению.
const падение = (ряд) => (ряд.length >= 2 ? Math.max(...ряд) - ряд[ряд.length - 1] : 0);
export function вкладкаКартыОтношений(отчёт, поиск = '') {
  const карта = (отчёт.maps && отчёт.maps.heat) || { people: [], pairs: [] };
  const люди = карта.people.filter(и => поиском(поиск, и));
  if (люди.length < 2) return пусто('Для карты нужны хотя бы двое, кто появлялся в сюжете вместе.');
  const пара = (а, б) => карта.pairs.find(п => (п.a === а && п.b === б) || (п.a === б && п.b === а));
  const наибольшее = Math.max(...карта.pairs.map(п => п.together), 1);
  const последнийХод = отчёт.range ? отчёт.range.to : 0;
  const давно = (п) => п.together > 0 && п.lastAt !== null && последнийХод - п.lastAt >= Math.max(30, (отчёт.range.to - отчёт.range.from) / 4);
  const ячейка = (а, б) => {
    if (а === б) return '<td class="self"></td>';
    const п = пара(а, б);
    if (!п) return '<td class="none"></td>';
    const напряжение = Math.max(падение(п.trustAB), падение(п.trustBA));
    const кл = [напряжение >= 15 ? 'is-tense' : '', давно(п) ? 'is-cold' : ''].filter(Boolean).join(' ');
    const подсказка = `${п.a} и ${п.b}: вместе ${п.together}${п.lastDate ? `, последний раз ${п.lastDate}` : ''}${напряжение >= 15 ? `; доверие упало на ${напряжение}` : ''}`;
    return `<td class="${кл}" style="--h:${(п.together / наибольшее).toFixed(2)}" title="${escapeHtml(подсказка)}">${п.together || ''}</td>`;
  };
  const таблица = `<div class="hud-arc-heat-wrap"><table class="hud-arc-heat"><thead><tr><th></th>${люди.map(и => `<th><span>${escapeHtml(и)}</span></th>`).join('')}</tr></thead><tbody>`
    + люди.map(а => `<tr><th>${escapeHtml(а)}</th>${люди.map(б => ячейка(а, б)).join('')}</tr>`).join('') + '</tbody></table></div>';
  const пары = карта.pairs.filter(п => люди.includes(п.a) && люди.includes(п.b));
  const напряжённые = пары.map(п => ({ п, d: Math.max(падение(п.trustAB), падение(п.trustBA)) })).filter(x => x.d >= 15).sort((а, б) => б.d - а.d).slice(0, 6);
  const холодные = пары.filter(давно).sort((а, б) => а.lastAt - б.lastAt).slice(0, 6);
  const частые = [...пары].sort((а, б) => б.together - а.together).filter(п => п.together).slice(0, 5);
  const список = (заголовок, ико, строки) => строки.length ? `<div class="hud-arc-heat-list"><b>${значок(ико)} ${заголовок}</b><ul>${строки.join('')}</ul></div>` : '';
  return `<section class="hud-arc-card hud-arc-heatmap"><div class="hud-arc-card-head">${значок('chain')} <b>Карта отношений</b></div>`
    + `<p class="hud-arc-note">Число и цвет — сколько ходов двое были в одном месте. Красная рамка — доверие пары падает, бледная клетка — давно не пересекались.</p>`
    + таблица
    + список('Чаще всего вместе', 'heart', частые.map(п => `<li>${escapeHtml(п.a)} ↔ ${escapeHtml(п.b)} <small>${п.together}</small></li>`))
    + список('Растёт напряжение', 'alert', напряжённые.map(({ п, d }) => `<li>${escapeHtml(п.a)} ↔ ${escapeHtml(п.b)} <small>доверие −${d}</small></li>`))
    + список('Давно не пересекались', 'clock', холодные.map(п => `<li>${escapeHtml(п.a)} ↔ ${escapeHtml(п.b)} <small>${п.lastDate ? 'последний раз ' + escapeHtml(п.lastDate) : 'давно'}</small></li>`))
    + '</section>';
}
