// hud-manager/render/secrets-grid.js
//
// Сетка «кто что знает» над списком секретов во вкладке «Память». Строки —
// секреты (опаснее — выше), столбцы — люди с аватарками. Три состояния из
// четырёх модель уже пишет: знает (knw, с обязательным «откуда»), не знает
// (hd или не в списке), подозревает (статус suspected/partial — кто не в
// списках, тот мог догадаться). Четвёртое — «ошибается» — единственная
// добавка в промпт: необязательный wrg «<имя>: во что верит вместо правды».
// У каждого состояния значок и цвет, не цвет один; подсказка клетки — откуда
// узнал или во что верит.
//
// Главная польза — предупреждение: в сцене есть тот, кто не знает опасного
// секрета, — «при нём об этом нельзя».
// На узком экране сетку заменяет список по людям (container query).

import { escapeHtml, getSafeUserName } from '../utils.js?v=23.46.0';
import { settings } from '../settings.js?v=23.46.0';
import { namesLikelySame } from '../names.js?v=23.46.0';
import { getAvatarUrl, getUserAvatarUrl } from '../avatars.js?v=23.46.0';
import { ико, медаль } from './view-icons.js?v=23.46.0';
// Склонение по числу: склон(3, ['секрет', 'секрета', 'секретов']).
const склон = (n, [один, два, пять]) => { const к = Math.abs(n) % 100, е = к % 10; return к > 10 && к < 20 ? пять : е === 1 ? один : е >= 2 && е <= 4 ? два : пять; };

const ПРЕДЕЛ_ЛЮДЕЙ = 10;
const пустоеИмя = (n) => !n || /^(none|empty|null|нет|никто|все|-|—)$/i.test(n);
const имяЧел = (x) => String((x && typeof x === 'object' ? (x.name || x.who || x.n) : x) || '').trim();
const списком = (v) => (Array.isArray(v) ? v : (v ? [v] : []));
const имяКоротко = (имя) => String(имя || '').replace(/^.*\s{2,}/, '').trim();
// Сравниваем без приставки карточки: «THE REGENTS  Tristan Kingsley» и «Тристан».
const тот = (a, b) => a && b && (namesLikelySame(имяКоротко(a), имяКоротко(b)) || namesLikelySame(a, b));

const ВЕС = { critical: 0, high: 1, medium: 2, low: 3 };
const уровень = (s) => { const l = String(s.level || '').toLowerCase(); return l.includes('crit') ? 'critical' : l.includes('high') ? 'high' : l.includes('low') ? 'low' : 'medium'; };

/** «Лена: думает, что он в Цюрихе; Коэн: что это шантаж» → [{ имя, верит }]. */
export function ошибающиеся(v) {
  return списком(v).flatMap(x => {
    if (x && typeof x === 'object') return [{ имя: имяЧел(x), верит: String(x.belief || x.b || x.v || '').trim() }];
    return String(x || '').split(';').map(ч => ч.trim()).filter(Boolean).map(ч => {
      const м = ч.match(/^([^:：]{1,40})[:：]\s*(.*)$/);
      return м ? { имя: м[1].trim(), верит: м[2].trim() } : { имя: ч, верит: '' };
    });
  }).filter(о => о.имя && !пустоеИмя(о.имя) && !/^(empty|none)$/i.test(о.имя));
}

/** Состояние клетки: { вид: 'knows' | 'suspects' | 'not' | 'wrong', текст }. */
export function клеткаСекрета(сек, человек) {
  const ош = ошибающиеся(сек.wrong).find(о => тот(о.имя, человек));
  // «думает, что отец — Брэндон» → «верит, что отец — Брэндон», без двойного «что».
  if (ош) return { вид: 'wrong', текст: ош.верит ? 'верит, что ' + ош.верит.replace(/^(?:(?:думает|считает|верит|уверен[аы]?|полагает|решил[аи]?)\s*,?\s*)?что\s+/i, '') : 'введён в заблуждение' };
  const зн = списком(сек.knows).find(k => тот(имяЧел(k), человек));
  if (зн) { const src = String((зн && зн.source) || '').trim(); return { вид: 'knows', текст: src ? 'знает: ' + src : 'знает' }; }
  if (списком(сек.unaware ?? сек.hidden).some(k => тот(имяЧел(k), человек))) return { вид: 'not', текст: 'не знает' };
  const ст = String(сек.status || '').toLowerCase();
  if (!/unknown|неизвест/.test(ст) && /suspect|подозр|part|частич/.test(ст)) return { вид: 'suspects', текст: 'мог догадаться — секрет уже расходится' };
  return { вид: 'not', текст: 'не знает' };
}

// Знак, слово и линейный значок (view-icons.js) каждого состояния. Значок и
// подпись есть всегда — состояние не держится на одном цвете.
const ЗНАКИ = { knows: ['✓', 'знает', 'eye'], suspects: ['?', 'подозревает', ''], not: ['·', 'не знает', ''], wrong: ['✗', 'ошибается', 'mask'] };
const значокСостояния = (вид) => (ЗНАКИ[вид][2] ? ико(ЗНАКИ[вид][2]) : `<b>${ЗНАКИ[вид][0]}</b>`);
const СЛОВО_УРОВНЯ = { critical: 'смертельно', high: 'опасно', medium: 'серьёзно', low: 'мелочь' };

// Группа, а не человек: «Пять Регентов», «Пресса», «Совет», «все слуги».
// Числительные и «все» — только целым словом: «Тристан» не «три».
const ГРУППА = /^(?:(?:\d+|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|вс[её]|двор)(?![\p{L}])|команд[аы](?![\p{L}])|семь[яи](?![\p{L}])|пресс|совет|слуг|прислуг|охран[аы](?![\p{L}])|полици|друзь|журналист|сосед|персонал|клан|банд[аы]|экипаж|гост[ия]|регент|орден)/iu;
export const этоГруппа = (имя) => ГРУППА.test(имяКоротко(имя).trim());

// Лицо в кольце: доля секретов, которые человек знает (--p, 0–100).
function лицо(имя, игрок, доля = null) {
  const кольцо = доля === null ? '' : ` style="--p:${доля}"`;
  if (!игрок && этоГруппа(имя)) return `<span class="hud-sgrid-ring"${кольцо}><span class="hud-sgrid-face is-group" title="группа">${ико('hearts')}</span></span>`;
  let url = '';
  try { url = игрок ? getUserAvatarUrl() : ((getAvatarUrl(имя) || {}).thumbUrl || (getAvatarUrl(имя) || {}).url || ''); } catch (_) { url = ''; }
  const буква = escapeHtml((имяКоротко(имя).match(/\p{L}/u) || ['?'])[0].toUpperCase());
  return `<span class="hud-sgrid-ring"${кольцо}><span class="hud-sgrid-face"${url ? ` style="background-image:url('${String(url).replace(/'/g, '%27')}')"` : ''}>${url ? '' : буква}</span></span>`;
}

/** Люди для столбцов: игрок, персонажи хода, затем все из списков секретов. */
function людиСекретов(секреты, hudData) {
  const игрок = (() => { try { return getSafeUserName() || ''; } catch (_) { return ''; } })();
  const out = [];
  const добавить = (имя, свой = false) => { if (!имя || пустоеИмя(имя) || out.some(п => тот(п.имя, имя))) return; out.push({ имя, игрок: свой }); };
  if (игрок) добавить(игрок, true);
  (Array.isArray(hudData && hudData.characters) ? hudData.characters : []).forEach(c => добавить(c && c['Имя']));
  секреты.forEach(с => {
    списком(с.knows).forEach(k => добавить(имяЧел(k)));
    списком(с.unaware ?? с.hidden).forEach(k => добавить(имяЧел(k)));
    ошибающиеся(с.wrong).forEach(о => добавить(о.имя));
  });
  return out.slice(0, ПРЕДЕЛ_ЛЮДЕЙ);
}

const заголовок = (факт) => { const слова = String(факт || '').trim().split(/\s+/); return слова.length > 7 ? слова.slice(0, 7).join(' ') + '…' : слова.join(' '); };

/** Предупреждения: в сцене есть тот, кто не знает опасного секрета. */
export function предупрежденияСекретов(секреты, hudData) {
  const тут = (Array.isArray(hudData && hudData.characters) ? hudData.characters : []).map(c => c && c['Имя']).filter(Boolean);
  const out = [];
  for (const с of секреты) {
    if (!['critical', 'high'].includes(уровень(с))) continue;
    const кто = тут.filter(имя => ['not', 'wrong'].includes(клеткаСекрета(с, имя).вид));
    if (кто.length) out.push({ секрет: с, кто: кто.map(имяКоротко), полные: кто });
  }
  return out;
}

export function сеткаСекретов(секретыВсе, hudData) {
  const режим = settings.secretsGrid || 'auto';
  const секреты = (Array.isArray(секретыВсе) ? секретыВсе : []).filter(с => с && typeof с === 'object' && String(с.fact || '').trim());
  if (режим === 'off' || !секреты.length || (режим === 'auto' && секреты.length < 3)) return '';
  секреты.sort((a, b) => ВЕС[уровень(a)] - ВЕС[уровень(b)]);
  const люди = людиСекретов(секреты, hudData);
  if (люди.length < 2) return '';
  // Таблица состояний: одна на всю отрисовку.
  const клетка = секреты.map(с => люди.map(п => клеткаСекрета(с, п.имя)));
  const долиЗнания = люди.map((_, j) => Math.round(секреты.filter((_, i) => клетка[i][j].вид === 'knows').length / секреты.length * 100));
  const предупреждения = предупрежденияСекретов(секреты, hudData);
  const опасных = секреты.filter(с => ['critical', 'high'].includes(уровень(с))).length;
  // Шапка: что это и сколько всего.
  const итог = `<div class="hud-sgrid-title">${медаль('lock')}<span><b>Кто что знает</b><small>${секреты.length} ${склон(секреты.length, ['секрет', 'секрета', 'секретов'])}`
    + `${опасных ? ` · ${опасных} ${склон(опасных, ['опасный', 'опасных', 'опасных'])}` : ''} · ${люди.length} ${склон(люди.length, ['человек', 'человека', 'человек'])}</small></span></div>`;
  const шапка = `<span class="hud-sgrid-corner"></span>` + люди.map((п, j) => `<span class="hud-sgrid-head" title="${escapeHtml(п.имя)} — знает ${долиЗнания[j]}%">${лицо(п.имя, п.игрок, долиЗнания[j])}<small>${escapeHtml(имяКоротко(п.имя).split(/\s+/)[0])}</small></span>`).join('');
  const строки = секреты.map((с, i) => {
    const ур = уровень(с);
    const клетки = люди.map((п, j) => {
      const к = клетка[i][j];
      return `<span class="hud-sgrid-cell is-${к.вид}" title="${escapeHtml(имяКоротко(п.имя) + ' — ' + к.текст)}" aria-label="${escapeHtml(имяКоротко(п.имя) + ': ' + ЗНАКИ[к.вид][1])}">${значокСостояния(к.вид)}</span>`;
    }).join('');
    const знают = клетка[i].filter(к => к.вид === 'knows').length;
    // Раскрытая строка: полный текст и кто откуда знает, кто во что верит.
    const откуда = люди.map((п, j) => ({ п, к: клетка[i][j] })).filter(x => x.к.вид !== 'not')
      .map(({ п, к }) => `<li class="is-${к.вид}">${значокСостояния(к.вид)}<b>${escapeHtml(имяКоротко(п.имя))}</b><span>${escapeHtml(к.текст)}</span></li>`).join('');
    return `<details class="hud-sgrid-row lvl-${ур}"><summary><span class="hud-sgrid-fact" title="${escapeHtml(с.fact)} · знают ${знают} из ${люди.length}" style="--k:${Math.round(знают / люди.length * 100)}%"><i class="hud-sgrid-lvl" title="${СЛОВО_УРОВНЯ[ур]}">${ико('lock')}</i><span>${escapeHtml(заголовок(с.fact))}</span><em>${знают}/${люди.length}</em></span>${клетки}</summary>`
      + `<div class="hud-sgrid-full"><p>${escapeHtml(с.fact)}</p><span class="hud-v-tag">${СЛОВО_УРОВНЯ[ур]}</span>${откуда ? `<ul>${откуда}</ul>` : ''}</div></details>`;
  }).join('');
  // Узкий экран: по человеку — что он знает, и полоска из четырёх долей.
  const поЛюдям = люди.map((п, j) => {
    const счёт = (вид) => секреты.filter((_, i) => клетка[i][j].вид === вид).length;
    const доли = ['knows', 'suspects', 'wrong', 'not'].map(вид => [вид, счёт(вид)]).filter(([, n]) => n);
    const полоска = `<span class="hud-sgrid-split">${доли.map(([вид, n]) => `<i class="is-${вид}" style="flex:${n}" title="${ЗНАКИ[вид][1]}: ${n}"></i>`).join('')}</span>`;
    const пункты = секреты.map((с, i) => { const к = клетка[i][j]; return `<li class="is-${к.вид} lvl-${уровень(с)}">${значокСостояния(к.вид)}<span>${escapeHtml(заголовок(с.fact))}</span><small>${escapeHtml(к.текст)}</small></li>`; }).join('');
    return `<details class="hud-sgrid-person"><summary>${лицо(п.имя, п.игрок, долиЗнания[j])}<b>${escapeHtml(имяКоротко(п.имя))}</b><small>знает ${счёт('knows')} · не знает ${счёт('not')}${счёт('wrong') ? ' · ошибается ' + счёт('wrong') : ''}</small>${полоска}</summary><ul>${пункты}</ul></details>`;
  }).join('');
  // «Не знают: Тристан, Лена» — без падежей: «при Тристан» звучало бы неграмотно.
  const предупр = предупреждения.map(п => `<div class="hud-sgrid-warn">${медаль('alert')}<span><small>в сцене — нельзя</small><b>«${escapeHtml(заголовок(п.секрет.fact))}»</b><em>${п.кто.length === 1 ? 'не знает' : 'не знают'}: ${escapeHtml(п.кто.join(', '))}</em></span><span class="hud-sgrid-warn-faces">${п.полные.slice(0, 3).map(имя => лицо(имя, false)).join('')}</span></div>`).join('');
  const легенда = `<div class="hud-sgrid-legend">${Object.entries(ЗНАКИ).map(([к, [, с]]) => `<span class="is-${к}"><i class="hud-sgrid-cell is-${к}">${значокСостояния(к)}</i>${с}</span>`).join('')}</div>`;
  return `<div class="hud-sgrid-wrap hud-v hud-v-card">${итог}${предупр}<div class="hud-sgrid" style="--cols:${люди.length}" role="table" aria-label="Кто что знает">`
    + `<div class="hud-sgrid-top">${шапка}</div>${строки}</div><div class="hud-sgrid-people">${поЛюдям}</div>${легенда}</div>`;
}
