// hud-manager/render/world-life-views.js
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.
// Reusing or reworking this code, by hand or with an AI assistant? Please keep this notice and credit the author.
//
// Виды средневековых блоков вкладки «Мир» (Кастомизация → Блоки: Мир):
//   · Правила места — «План слободы» и «Колокол глашатая»;
//   · Честь — «Гербовник общин» и «Хор свидетелей»;
//   · Вера — «Окна часовни» и «Огонь бдения»;
//   · Домочадцы — «Связка ключницы» и «Разрез усадьбы»;
//   · Суд и закон — «Весы суда» и «Зарубки тяжбы».
// Данные те же, что у прежних карточек (render/place-lore.js, medieval-life.js):
// модель ничего нового не пишет. Перенесено со стенда tests/tools/world-life-stand.
// Вид живёт в обёртке .hud-mv .hud-wl: лист прозрачный и с размытием, как у
// остальных средневековых видов (css/world-life-views.css).

import { escapeHtml } from '../utils.js?v=23.89.96';
import { engravings as art, householdRooms } from './world-life-art.js?v=23.89.96';

const э = (s) => escapeHtml(String(s ?? ''));
const есть = (v) => v !== undefined && v !== null && String(v).trim() !== '';
const тег = (имя, v, класс = '') => есть(v) ? `<${имя}${класс ? ` class="${класс}"` : ''}>${э(v)}</${имя}>` : '';
const колонки = (n) => `wl-n${Math.max(1, Math.min(3, n))}`;
// Краткая запись: сначала главное, подробности раскрываются плавно по нажатию и так же
// сворачиваются (css: .wl-more — сетка 0fr → 1fr). Нет подробностей — запись не нажимается.
export const подробно = (тело) => тело ? `<div class="wl-more"><div class="wl-more-in">${тело}</div></div><span class="wl-chev" aria-hidden="true"></span>` : '';
export const пункт = (тело) => тело ? ' wl-item" data-wl-item role="button" tabindex="0" aria-expanded="false' : '';

/** Секция вкладки «Мир» с видом. заголовок — с эмодзи (значки по iconSet меняет hud-icons.js); пусто — без него. */
function секция(блок, заголовок, вид, тело) {
  return `<div class="hud-world-section hud-mv-section hud-wl-section" data-wl-block="${блок}">`
    + (заголовок ? `<div class="hud-world-title">${заголовок}</div>` : '')
    + `<div class="hud-mv hud-wl"><div class="wl-sheet wl-${вид}" role="group">${тело}</div></div></div>`;
}

// --- Правила места -----------------------------------------------------------------
// д: { места: [{ имя, id }], правила: [{ где, текст, когда, кого, иначе, сейчас }],
//      власть: [{ кто, области, заметка }], кнопки: html (новое место, забыть) }
function власть(д) {
  if (!д.власть.length) return '';
  // Кратко — только у кого власть; чем распоряжается — по нажатию.
  const чем = (в) => `${в.области ? `<b>${э(в.области)}</b>` : ''}${в.области && в.заметка ? ' · ' : ''}${э(в.заметка)}`;
  const естьЧем = д.власть.some(в => есть(в.области) || есть(в.заметка));
  return `<footer class="authority${пункт(естьЧем)}"><h4>Чья здесь власть</h4><dl>${д.власть.map(в => `<div><dt>${э(в.кто)}</dt>${есть(в.области) || есть(в.заметка) ? `<dd class="wl-more"><div class="wl-more-in">${чем(в)}</div></dd>` : ''}</div>`).join('')}</dl>${естьЧем ? '<span class="wl-chev" aria-hidden="true"></span>' : ''}</footer>`;
}
const ПОДПИСИ_МЕТОК = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];
function записьПлана(п, i, выбран) {
  const тело = `<dl><div><dt>Когда</dt><dd>${э(п.когда || 'Всегда')}</dd></div><div><dt>Для кого</dt><dd>${э(п.кого || 'Для всех')}</dd></div></dl>`
    + (есть(п.иначе) ? `<p class="map-risk"><b>Последствие</b> ${э(п.иначе)}</p>` : '');
  return `<article class="map-record loc-${i}${пункт(тело)}" data-wl-record="${i}"${выбран ? '' : ' hidden'}>${есть(п.где) ? `<small>${э(п.где)}${п.сейчас ? ' · <span class="map-now">действует сейчас</span>' : ''}</small>` : ''}<h4>${э(п.текст)}</h4>`
    + подробно(тело) + `</article>`;
}
function планСлободы(д) {
  const правила = д.правила.slice(0, 6);
  const первый = Math.max(0, правила.findIndex(п => п.сейчас));
  const метка = (п, i, текст, класс) => `<button type="button" class="${класс} loc-${i}${п.сейчас ? ' is-now' : ''}" data-wl-place="${i}" aria-pressed="${i === первый}" aria-label="${э(п.где || п.текст)}">${текст}</button>`;
  return `<header class="atlas-heading"><small>План места</small><h3>${э(д.места.map(м => м.имя).join(' · '))}</h3></header>`
    + `<div class="map-art">${art.map()}${правила.map((п, i) => метка(п, i, ПОДПИСИ_МЕТОК[i], 'map-dot')).join('')}</div>`
    + (правила.length ? `<div class="map-key" aria-label="Участки на плане">${правила.map((п, i) => метка(п, i, `<i>${ПОДПИСИ_МЕТОК[i]}</i>${э(п.где || п.текст)}`, 'map-tab')).join('')}</div>` : '')
    + `<div class="map-records" aria-live="polite">${правила.length ? правила.map((п, i) => записьПлана(п, i, i === первый)).join('') : '<p class="map-empty">Сейчас здесь ничто не ограничивает.</p>'}</div>`
    + власть(д) + д.кнопки;
}
function колоколГлашатая(д) {
  const лист = (п) => {
    const тело = (есть(п.когда) ? `<p class="bell-time">${э(п.когда)}</p>` : '') + (есть(п.иначе) ? `<footer><b>При нарушении</b>${э(п.иначе)}</footer>` : '');
    return `<article class="broadside${пункт(тело)}"><small>${[п.где, п.кого].filter(есть).map(э).join(' · ')}</small><h4>${э(п.текст)}</h4>${подробно(тело)}</article>`;
  };
  const сейчас = д.правила.filter(п => п.сейчас), прочие = д.правила.filter(п => !п.сейчас);
  const главные = (сейчас.length ? сейчас : прочие).slice(0, 2);
  const запас = д.правила.filter(п => !главные.includes(п));
  return `<header class="belfry"><div><small>Глашатай объявляет</small><h3>${э(д.места.map(м => м.имя).join(' · '))}</h3></div>${art.bell()}</header>`
    + (главные.length ? `<div class="billboard ${колонки(главные.length)}">${главные.map(лист).join('')}</div>` : '<p class="bell-quiet">Сейчас здесь ничто не ограничивает.</p>')
    + (запас.length ? `<details class="reserve"><summary>Другие правила · ${запас.length}</summary>${запас.map(лист).join('')}</details>` : '')
    + власть(д) + д.кнопки;
}

// --- Честь --------------------------------------------------------------------------
// ряды: [{ среда, кому, суждение, почему, тон: good | bad | mid }]
const ОТНОШЕНИЕ = { good: 'support', bad: 'doubt', mid: 'neutral' };
function гербовник(ряды) {
  return `<div class="standards ${колонки(ряды.length)}">${ряды.map((р, i) => {
    const тело = (есть(р.кому) ? `<small>О ком судят · ${э(р.кому)}</small>` : '') + тег('p', р.почему);
    return `<article class="standard livery-${i % 3}${пункт(тело)}"><header><div class="embroidery">${art.shield(i % 3)}</div><h3>${э(р.среда)}</h3></header>`
      + `<div class="blazon-text">${тег('b', р.суждение, `judgement ${ОТНОШЕНИЕ[р.тон]}`)}${подробно(тело)}</div></article>`;
  }).join('')}</div>`;
}
function хорСвидетелей(ряды) {
  const люди = [...new Set(ряды.map(р => String(р.кому || '').trim()))];
  return `<div class="testimony">${люди.map(кто => `<section><h3><small>${кто ? 'О ком говорят' : 'Что говорят'}</small>${э(кто)}</h3>`
    + ряды.map((р, i) => String(р.кому || '').trim() === кто ? `<figure class="${ОТНОШЕНИЕ[р.тон]}${пункт(есть(р.почему))}"><div class="speaker">${art.witness(i % 3)}</div><div><figcaption>${э(р.среда)}</figcaption>${есть(р.суждение) ? `<blockquote>«${э(р.суждение)}»</blockquote>` : ''}${подробно(тег('p', р.почему))}</div></figure>` : '').join('')
    + `</section>`).join('')}</div>`;
}

// --- Вера ---------------------------------------------------------------------------
// ряды: [{ что, кто, состояние, почему, ступень?: 0..3, ступени?: [4 слова] }] — ступень только у обвинения.
function обвинение(р) {
  return `<div class="rumour"><b>${э(р.состояние)}</b><span class="rumour-scale" role="img" aria-label="${э(р.ступени[р.ступень])}">${р.ступени.map((_, j) => `<i class="${j === р.ступень ? 'now' : j < р.ступень ? 'past' : ''}"></i>`).join('')}</span></div>`;
}
function окнаЧасовни(ряды) {
  const окна = ряды.slice(0, 3);
  return `<div class="rose-wall ${колонки(окна.length)}" aria-hidden="true">${окна.map((_, i) => `<div class="lancet glass-${i % 3}">${art.windowPane(i % 3)}</div>`).join('')}</div>`
    + `<div class="chapel ${колонки(ряды.length)}">${ряды.map((р, i) => `<article class="glass-${i % 3}${пункт(есть(р.почему))}"><div class="inlay"></div><small>${э(р.что)}</small><h3>${э(р.кто)}</h3>`
      + (р.ступени ? обвинение(р) : тег('strong', р.состояние)) + `${подробно(тег('p', р.почему))}</article>`).join('')}</div>`;
}
function огоньБдения(ряды) {
  const свечи = Math.min(3, ряды.length);
  return `<div class="vigil"><div class="altar" aria-hidden="true">${Array.from({ length: свечи }, (_, i) => art.candle(i)).join('')}</div>`
    + `<div class="vigil-notes">${ряды.map((р, i) => `<article class="intention intent-${i % 3}${пункт(есть(р.почему))}"><header><small>${э(р.что)}</small><h3>${э(р.кто)}</h3></header>`
      + `<div>${р.ступени ? обвинение(р) : тег('em', р.состояние)}${подробно(тег('p', р.почему))}</div></article>`).join('')}</div></div>`;
}

// --- Домочадцы ----------------------------------------------------------------------
// ряды: [{ кто, роль, верность: число | null, верностьТекст, занят }]
const тонВерности = (в) => в === null ? 'none' : в >= 80 ? 'high' : в >= 50 ? 'middle' : 'low';
function верностьЯрлыка(р) {
  if (р.верность === null) return есть(р.верностьТекст) ? `<div class="trust"><span>Верность</span><em>${э(р.верностьТекст)}</em></div>` : '';
  const в = Math.round(р.верность);
  return `<div class="trust"><span>Верность</span><b>${в}<small> / 100</small></b><span class="trust-bar" role="img" aria-label="Верность ${в} из 100"><i style="width:${в}%"></i></span></div>`;
}
function связкаКлючницы(ряды) {
  return `<div class="keyrack ${колонки(ряды.length)}">${ряды.map((р, i) => `<article class="key-tag ${тонВерности(р.верность)}${пункт(есть(р.занят))}"><div class="peg">${art.key(i % 3)}</div><div class="key-card"><div class="eyelet"></div>`
    + `${тег('small', р.роль)}<h3>${э(р.кто)}</h3>${верностьЯрлыка(р)}${подробно(тег('p', р.занят))}</div></article>`).join('')}</div>`;
}
function разрезУсадьбы(ряды) {
  const комнаты = ряды.map(р => {
    const комната = householdRooms.find(р.роль);
    const верность = р.верность === null ? (есть(р.верностьТекст) ? `<strong class="trust-pin none">Верность · ${э(р.верностьТекст)}</strong>` : '')
      : `<strong class="trust-pin ${тонВерности(р.верность)}">Верность · ${Math.round(р.верность)} из 100</strong>`;
    return `<article class="room${пункт(есть(р.занят))}" data-room="${комната[0]}"><div class="chamber">${householdRooms.picture(комната)}<span>${э(комната[1])}</span></div>`
      + `<div class="occupant">${тег('small', р.роль)}<h3>${э(р.кто)}</h3>${верность}${подробно(тег('p', р.занят))}</div></article>`;
  });
  return `<div class="roof" aria-hidden="true"></div><div class="manor${ряды.length === 1 ? ' is-single' : ''}">${комнаты.join('')}</div>`;
}

// --- Суд и закон --------------------------------------------------------------------
// ряды: [{ кто, обвинение, стадия, судья, итог, решено }]
function весыСуда(ряды) {
  return `<div class="court-frieze" aria-hidden="true">${art.column()}${art.scales()}${art.column()}</div><div class="tribunal">${ряды.map(р => {
    const ст = есть(р.обвинение) || есть(р.судья) ? `<dl>${есть(р.обвинение) ? `<div><dt>Обвинение</dt><dd>${э(р.обвинение)}</dd></div>` : ''}${есть(р.судья) ? `<div><dt>Судит</dt><dd>${э(р.судья)}</dd></div>` : ''}</dl>` : '';
    const тело = ст + (есть(р.итог) ? `<div class="ruling"><b>${р.решено ? 'Решение суда' : 'Предписание'}</b><p>${э(р.итог)}</p></div>` : '');
    return `<article class="${р.решено ? 'decided' : 'summoned'}${пункт(тело)}"><div class="hearing">${тег('small', р.стадия)}<h3>${э(р.кто)}</h3></div>${подробно(тело)}</article>`;
  }).join('')}</div>`;
}
// Кратко — имя и стадия на бирке; расколотая бирка с обвинением и решением — по нажатию.
function зарубкиТяжбы(ряды) {
  return `<div class="tallies">${ряды.map(р => {
    const тело = `<div class="split-stick"><section><small>Обвинение</small>${тег('p', р.обвинение || '—')}</section>`
      + `<section>${есть(р.судья) ? `<small>Судит · ${э(р.судья)}</small>` : ''}<h4>${р.решено ? 'Решение' : 'Что дальше'}</h4>${тег('p', р.итог || '—')}</section></div>`;
    return `<article class="${пункт(тело).replace(/^ /, '')}"><header>${art.tally()}<h3>${э(р.кто)}</h3>${есть(р.стадия) ? `<b class="stage" data-final="${!!р.решено}">${э(р.стадия)}</b>` : ''}</header>${подробно(тело)}</article>`;
  }).join('')}</div>`;
}

// --- Выбор -------------------------------------------------------------------------------
const ВИДЫ = {
  place: { atlas: планСлободы, bell: колоколГлашатая },
  hon: { arms: гербовник, voices: хорСвидетелей },
  fth: { glass: окнаЧасовни, wax: огоньБдения },
  hh: { keys: связкаКлючницы, house: разрезУсадьбы },
  law: { court: весыСуда, tally: зарубкиТяжбы },
};
/** Есть ли у блока такой вид (иначе — прежняя карточка). */
export const естьВидЖизни = (блок, вид) => !!(ВИДЫ[блок] && ВИДЫ[блок][вид]);
/**
 * Блок «Жизни эпохи» в выбранном виде. блок: place | hon | fth | hh | law;
 * данные — разобранные ряды (у места — объект, см. выше); заголовок — с эмодзи
 * или '' (у места заголовок — на самом листе).
 */
export function видЖизни(блок, вид, данные, заголовок = '') {
  const рисунок = ВИДЫ[блок] && ВИДЫ[блок][вид];
  if (!рисунок) return '';
  const пусто = блок === 'place' ? !данные || !данные.места || !данные.места.length : !Array.isArray(данные) || !данные.length;
  return пусто ? '' : секция(блок, заголовок, вид, рисунок(данные));
}

// План места: метка или участок в легенде показывает свою запись.
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function' && !globalThis.__hudWlBound) {
  globalThis.__hudWlBound = true;
  // Запись раскрывается и сворачивается по нажатию (и Enter или пробелом). Выделение текста
  // мышью запись не трогает, кнопки и ссылки внутри работают как обычно.
  const переключить = (п) => п.setAttribute('aria-expanded', String(п.getAttribute('aria-expanded') !== 'true'));
  const запись = (e) => {
    const п = e.target && e.target.closest ? e.target.closest('[data-wl-item]') : null;
    return п && п.closest('.hud-mv') && !e.target.closest('button, a, input, select, textarea, summary') ? п : null;
  };
  document.addEventListener('click', (e) => {
    const п = запись(e);
    if (п && !String(globalThis.getSelection?.() || '').trim()) переключить(п);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const п = запись(e);
    if (п && e.target === п) { e.preventDefault(); переключить(п); }
  });
  document.addEventListener('click', (e) => {
    const метка = e.target && e.target.closest ? e.target.closest('[data-wl-place]') : null;
    const лист = метка && метка.closest('.wl-sheet');
    if (!лист) return;
    const n = метка.dataset.wlPlace;
    лист.querySelectorAll('[data-wl-place]').forEach(б => б.setAttribute('aria-pressed', String(б.dataset.wlPlace === n)));
    лист.querySelectorAll('[data-wl-record]').forEach(з => { з.hidden = з.dataset.wlRecord !== n; });
  });
}
