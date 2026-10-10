// hud-manager/render/cycle-libido.js
//
// Полоса влечения под блоком цикла. Промпт не нужен: фаза и день цикла уже
// приходят (Mns), стресс, силы и сон — в «Состоянии тела» (Bs), желание — в
// близости (ds: «strength of desire and for what»).
//
// Рисуются две вещи сразу, и это главное:
//   линия — склонность по фазе, её считает HUD: менструация — низко,
//           фолликулярная — рост, овуляция — пик, лютеиновая — спад,
//           окно ПМС — провал;
//   точки — фактическое желание из прошлых ходов, когда о нём писали.
// Расхождение линии и точек — не ошибка, а характер: фаза задаёт только фон.
// Поверх фона — поправка на сегодня: сильный стресс, мало сил, короткий сон
// снижают. Рядом с картинкой всегда те же значения словами.
// Отдельная строка под любым из семи видов цикла (settings.cycleLibido).

import { escapeHtml, flattenFieldValue, снятьЗаглушки } from '../utils.js?v=23.48.3';
import { settings } from '../settings.js?v=23.48.3';
import { ико } from './view-icons.js?v=23.48.3';

const поле = (о, имя) => {
  if (!о || typeof о !== 'object') return '';
  const ключ = Object.keys(о).find(k => k.toLowerCase() === имя.toLowerCase());
  return ключ ? String(снятьЗаглушки(flattenFieldValue(о[ключ])) || '').trim() : '';
};
const ограничить = (x, a, b) => Math.max(a, Math.min(b, x));

/** Склонность по фазе, 0–1, для дня d цикла длины L с овуляцией в ov. */
export function фонВлечения(d, L, ov, pl = 5) {
  let v;
  if (d <= pl) v = .22 + .06 * (d - 1) / Math.max(1, pl - 1);
  else if (d < ov - 1) v = .35 + .37 * (d - pl - 1) / Math.max(1, ov - 2 - pl - 1);
  else if (d <= ov + 1) v = d === ov ? 1 : .9;
  else v = .7 - .3 * (d - ov - 2) / Math.max(1, L - ov - 2);
  // Окно ПМС — последние шесть дней: провал к двум дням до месячных.
  const доМесячных = L - d;
  if (доМесячных <= 6) v -= .15 * Math.exp(-((доМесячных - 2) ** 2) / 4);
  return ограничить(v, .05, 1);
}

// «Состояние тела»: «eng: 45 — усталость; str: 80; slp: 4 ч, лёг в 03:00».
function числоИз(текст, код) {
  const м = String(текст || '').match(new RegExp('(?:^|[;\\s])' + код + '\\s*:\\s*(\\d{1,3})', 'i'));
  return м ? +м[1] : null;
}
function часыСна(текст) {
  const s = (String(текст || '').match(/(?:^|[;\s])slp\s*:\s*([^;]+)/i) || [])[1] || '';
  const ч = s.match(/(\d+(?:[.,]\d)?)\s*(?:ч|час|h)/i);
  if (ч) return parseFloat(ч[1].replace(',', '.'));
  const и = s.match(/(\d{1,2})[:.](\d{2})\s*[–—-]\s*(\d{1,2})[:.](\d{2})/);
  if (!и) return null;
  let мин = (+и[3] * 60 + +и[4]) - (+и[1] * 60 + +и[2]);
  if (мин < 0) мин += 1440;
  return мин / 60;
}
/** Поправка на сегодня: { доля, причины[] } — во сколько раз ниже фона. */
export function поправкаВлечения(владелец) {
  const bs = поле(владелец, 'Состояние тела');
  const причины = [];
  let доля = 1;
  const str = числоИз(bs, 'str'), eng = числоИз(bs, 'eng'), сон = часыСна(bs);
  if (str !== null && str > 60) { доля *= 1 - (str - 60) / 100; причины.push('стресс ' + str); }
  if (eng !== null && eng < 40) { доля *= 1 - (40 - eng) / 80; причины.push('мало сил'); }
  if (сон !== null && сон < 6) { доля *= .9; причины.push('недосып'); }
  return { доля: ограничить(доля, .4, 1), причины };
}

// Желание из «ds»: число, если оно есть, иначе по словам. Неясно — точки нет:
// лучше пропуск, чем выдуманная отметка.
const СИЛЬНО = /неистов|безумн|жажд|пожира|невыносим|сильн|остр|жгуч|пыла|всепоглощ|изныва|вожделен|голод|нестерпим|отчаянн|одержим|умоляет|не может ждать/i;
const СЛАБО = /нет желани|не хочет|отвращ|отторж|холодн|равнодуш|нежелани|паник|ужас|страх|(?<![а-яё])бол(?:ь|и|ью)(?![а-яё])|сопротивл|принужд|онемел|пусто/i;
const СРЕДНЕ = /желани|тянет|интерес|любопыт|влечени|тепл|хочет|нужда|ищет/i;
export function желаниеИз(nsfw) {
  const ds = (String(nsfw || '').match(/(?:^|;)\s*ds\s*:\s*([^;]+)/i) || [])[1];
  if (!ds) return null;
  const ч = ds.match(/^\s*(\d{1,3})\s*%?/);
  if (ч) return { v: ограничить(+ч[1] / 100, 0, 1), текст: ds.trim() };
  const v = СЛАБО.test(ds) ? .2 : СИЛЬНО.test(ds) ? .85 : СРЕДНЕ.test(ds) ? .55 : null;
  return v === null ? null : { v, текст: ds.trim() };
}
const словоУровня = (v) => v >= .85 ? 'пик' : v >= .62 ? 'высокое' : v >= .4 ? 'среднее' : 'низкое';
const деньИз = (текст) => { const м = String(текст || '').match(/(?:cyd|день цикла)\s*:\s*(\d{1,2})/i); return м ? +м[1] : null; };

/**
 * В — разбор цикла из buildCycle ({ L, день, ov, отрезки, опоздание });
 * владелец — объект персонажа (Bs, NSFW, история ходов).
 */
export function полосаВлечения(В, владелец) {
  const режим = settings.cycleLibido || 'phase+actual';
  if (режим === 'off' || !В || !В.день || В.опоздание || В.день > В.L) return '';
  const { L, день, ov } = В;
  const X = (d) => 8 + (d - 1) / (L - 1) * 264, Y = (v) => 46 - v * 36;
  let путь = '';
  for (let d = 1; d <= L; d++) путь += (d === 1 ? 'M' : 'L') + X(d).toFixed(1) + ' ' + Y(фонВлечения(d, L, ov)).toFixed(1);
  const фон = фонВлечения(день, L, ov);
  const п = поправкаВлечения(владелец);
  const сегодня = фон * п.доля;
  // Точки: прошлые ходы этого цикла, где желание названо.
  const точки = [];
  if (режим === 'phase+actual') {
    const сейчас = typeof владелец?.__hudМомент === 'function' ? владелец.__hudМомент() : null;
    let история = [];
    try { история = typeof владелец?.__hudИстория === 'function' ? владелец.__hudИстория() : []; } catch (_) { история = []; }
    const сегодняЖ = желаниеИз(поле(владелец, 'NSFW') || поле(владелец, 'NSFW (Юзер)'));
    if (сегодняЖ) точки.push({ d: день, ...сегодняЖ, когда: 'сейчас' });
    for (const х of история) {
      const ж = желаниеИз(поле(х.данные, 'NSFW') || поле(х.данные, 'NSFW (Юзер)'));
      if (!ж) continue;
      let d = деньИз(поле(х.данные, 'Цикл'));
      if (!d && сейчас && х.момент) d = день - Math.round((сейчас - х.момент) / 864e5);
      if (!d || d < 1 || d > L || d > день) continue;
      if (точки.some(т => т.d === d)) continue;
      точки.push({ d, ...ж, когда: х.назад === 1 ? 'ход назад' : х.назад + ' хода назад' });
    }
  }
  const пмс = `<rect class="lib-pms" x="${X(L - 6).toFixed(1)}" y="8" width="${(X(L) - X(L - 6)).toFixed(1)}" height="40" rx="3"><title>Окно ПМС</title></rect>`;
  const отрезки = (В.отрезки || []).map(([k, a, b]) => `<rect class="lib-seg" x="${X(a).toFixed(1)}" y="48" width="${Math.max(1, X(b) - X(a)).toFixed(1)}" height="3" rx="1.5" style="fill:var(--cyc-${k})"/>`).join('');
  const метки = точки.map(т => `<circle class="lib-dot" cx="${X(т.d).toFixed(1)}" cy="${Y(т.v).toFixed(1)}" r="3"><title>${escapeHtml(`День ${т.d} (${т.когда}): ${т.текст}`)}</title></circle>`).join('');
  const svg = `<svg class="hud-libido-svg" viewBox="0 0 280 54" role="img" aria-label="Влечение по дням цикла: сегодня ${словоУровня(сегодня)}">`
    + пмс + отрезки
    // Заливка под линией — градиентом цвета фазы: видно, где пик, издалека.
    + `<defs><linearGradient id="hud-lib-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".35"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>`
    + `<path class="lib-area" d="${путь} L${X(L).toFixed(1)} 48 L${X(1).toFixed(1)} 48 Z"/><path class="lib-line" d="${путь}"/>`
    + `<path class="lib-now" d="M${X(день).toFixed(1)} 6V48"/>`
    + `<circle class="lib-today" cx="${X(день).toFixed(1)}" cy="${Y(фон).toFixed(1)}" r="3.4"><title>Фон по фазе: ${словоУровня(фон)}</title></circle>`
    + (п.доля < .95 ? `<circle class="lib-adj" cx="${X(день).toFixed(1)}" cy="${Y(сегодня).toFixed(1)}" r="3.4"><title>С поправкой: ${escapeHtml(п.причины.join(', '))}</title></circle>` : '')
    + метки + `</svg>`;
  const слова = `<b>Влечение по фазе: ${словоУровня(фон)}</b>`
    + (п.доля < .95 ? ` · сегодня ниже: ${escapeHtml(п.причины.join(', '))}` : '')
    + (точки.length ? ` · точки — как было на деле` : '');
  return `<div class="hud-libido"><span class="hud-libido-title">${ико('flame')}Влечение<em>${словоУровня(сегодня)}</em></span>${svg}<p class="hud-libido-text">${слова}</p></div>`;
}
