// hud-manager/render/duel.js
//
// Словесная дуэль — механика хода поверх «Глубины конфликта» (X: в чём суть,
// сколько дней, стадия). Модель пишет необязательный Vd, только пока идёт
// спор: 'ini: кто ведёт разговор и насколько прочно, 0-100; gv: кто сдал
// позицию в этом ходе и в чём; tn: спор | укол | ссора | крик | холод |
// примирение'. Остальное HUD выводит сам:
//   перетягивание — где указатель сейчас и насколько сдвинулся с прошлого
//                   хода («отыграла 20»): ощущение спора — сдвиг, а не место;
//   уступки       — кто что сдал, по ходам, за весь спор;
//   градус        — лесенкой-термометром, значок и подпись;
//   всплыло       — запись памяти (таймлайн, важное), с которой совпадает
//                   суть спора: «это про тот вечер 12-го».

import { escapeHtml, flattenFieldValue, снятьЗаглушки } from '../utils.js?v=23.48.3';
import { namesLikelySame } from '../names.js?v=23.48.3';
import { settings } from '../settings.js?v=23.48.3';
import { getAvatarUrl } from '../avatars.js?v=23.48.3';
import { ико, медаль } from './view-icons.js?v=23.48.3';

const текст = (v) => String(снятьЗаглушки(flattenFieldValue(v)) || '').trim();
const поле = (о, имя) => {
  if (!о || typeof о !== 'object') return '';
  const ключ = Object.keys(о).find(k => k.toLowerCase() === имя.toLowerCase());
  return ключ ? текст(о[ключ]) : '';
};
const пусто = (s) => !s || /^(empty|none|нет|—|-)$/i.test(String(s).trim());
const имяКоротко = (имя) => String(имя || '').replace(/^.*\s{2,}/, '').trim().split(/\s+/)[0] || '';
const тот = (a, b) => a && b && namesLikelySame(имяКоротко(a), имяКоротко(b));

// Градус: от тёплого к горячему. Второе — линейный значок из view-icons.js.
export const ГРАДУС = [
  ['примирение', 'heart', 'is-peace'], ['холод', 'snow', 'is-cold'], ['спор', 'speech', 'is-argue'],
  ['укол', 'dagger', 'is-jab'], ['ссора', 'bolt', 'is-fight'], ['крик', 'megaphone', 'is-shout'],
];

// Слова тона по ступеням ГРАДУС (тот же порядок): «приказ» — властный холод,
// «допрос» и «угроза» — укол, «насилие», «удар», «ярость» — ссора.
const СИНОНИМЫ_ГРАДУСА = [
  /(?<![\p{L}])(?:примир|мир(?:ятся|имся|но)|нежн|тепл|прощ)/iu,
  /(?<![\p{L}])(?:холод|ледян|отстран|молчан|игнор|приказ|доминац|доминир|триумф|властн)/iu,
  /(?<![\p{L}])(?:спор|препира|торг|возраж)/iu,
  /(?<![\p{L}])(?:укол|колк|язв|сарказ|насмеш|издёв|издев|допрос|угроз|шантаж)/iu,
  /(?<![\p{L}])(?:ссор|ярост|гнев|злост|насил|удар|драк|бешен)/iu,
  /(?<![\p{L}])(?:крик|орёт|орет|вопл|рык|рёв|рев(?![\p{L}]))/iu,
];

// Лицо спорщика: аватарка карточки или буква на акценте (как в сетке секретов).
function лицо(имя, кл = '') {
  let url = '';
  try { url = (getAvatarUrl(имя) || {}).thumbUrl || (getAvatarUrl(имя) || {}).url || ''; } catch (_) { url = ''; }
  const буква = escapeHtml((имяКоротко(имя).match(/\p{L}/u) || ['?'])[0].toUpperCase());
  return `<span class="hud-v-face hud-duel-face${кл}"${url ? ` style="background-image:url('${String(url).replace(/'/g, '%27')}')"` : ''}>${url ? '' : буква}</span>`;
}

/** «ini: Софи, 70; gv: Тристан уступил в деньгах; tn: ссора» → разбор. */
export function разобратьДуэль(value) {
  const s = текст(value);
  if (пусто(s)) return null;
  const ч = {};
  s.split(';').forEach(x => { const м = x.match(/^\s*(ini|gv|tn)\s*[:：]\s*(.+)$/i); if (м) ч[м[1].toLowerCase()] = м[2].trim(); });
  if (!ч.ini && !ч.gv && !ч.tn) return null;
  const м = String(ч.ini || '').match(/^(.*?)[,:—–-]?\s*(\d{1,3})\s*%?\s*$/);
  const ведёт = м ? м[1].replace(/[,:—–-]\s*$/, '').trim() : String(ч.ini || '').trim();
  const сила = м ? Math.max(0, Math.min(100, +м[2])) : null;
  // «холод | укол | приказ» — модель называет несколько тонов: берём самый
  // горячий из названных. Слова вне списка — по синонимам ступеней.
  const тон = String(ч.tn || '');
  const градус = СИНОНИМЫ_ГРАДУСА.reduce((выше, rx, i) => (rx.test(тон) ? i : выше), -1);
  return { ведёт, сила, уступка: пусто(ч.gv) ? '' : ч.gv, градус, тон: ч.tn || '' };
}

// Положение указателя для персонажа: 100 — он полностью ведёт.
const положение = (д, имя) => (д && д.сила !== null ? (тот(д.ведёт, имя) ? д.сила : 100 - д.сила) : null);

const значимые = (s) => new Set(String(s || '').toLowerCase().replace(/ё/g, 'е').split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 4));
/** Запись памяти, с которой совпадает суть спора: два и больше значимых слова. */
export function всплылоИзПамяти(суть, память, сейчас = '') {
  const А = значимые(суть);
  if (А.size < 2 || !память) return null;
  const записи = [...(Array.isArray(память.important) ? память.important : []), ...(Array.isArray(память.timeline) ? память.timeline : [])].map(текст).filter(Boolean);
  const Сейчас = значимые(сейчас);
  const общих = (слова, с, корень = 6) => [...слова].filter(w => [...с].some(a => a.slice(0, корень) === w.slice(0, корень))).length;
  let лучшая = null, лучшийСчёт = 1;
  for (const з of записи) {
    const слова = значимые(з);
    const счёт = общих(слова, А);
    // Запись, которая просто пересказывает суть спора, — не «всплывшее».
    if (слова.size && счёт / слова.size >= .75) continue;
    // Запись о том, что идёт в этом же ходе (поза, близость), — не прошлое.
    // Сравниваем по пятибуквенным корням: «горловой» и «горлового», «жестокий» и «жёсткого».
    if (Сейчас.size && общих(слова, Сейчас, 5) >= 2) continue;
    if (счёт > лучшийСчёт) { лучшийСчёт = счёт; лучшая = з; }
  }
  return лучшая;
}

export function buildDuel(value, c) {
  const д = разобратьДуэль(value);
  if (!д) return '';
  const я = c && c['Имя'];
  let история = [];
  try { история = c && typeof c.__hudИстория === 'function' ? c.__hudИстория() : []; } catch (_) { история = []; }
  // Прошлые ходы того же спора — подряд, пока Vd был.
  const прошлые = [];
  for (const х of история) { const п = разобратьДуэль(поле(х.данные, 'Словесная дуэль')); if (!п) break; прошлые.push({ ...п, назад: х.назад }); }
  const соперник = [д, ...прошлые].map(x => x.ведёт).find(n => n && !тот(n, я))
    || (д.уступка.match(/^([\p{Lu}][\p{L}-]+)/u) || [])[1] || 'собеседник';
  const сейчас = положение(д, я), было = прошлые.length ? положение(прошлые[0], я) : null;
  const сдвиг = сейчас !== null && было !== null ? сейчас - было : 0;
  const вид = ['tug', 'scales', 'chart'].includes(settings.duelView) ? settings.duelView : 'tug';
  const яК = escapeHtml(имяКоротко(я)), онК = escapeHtml(имяКоротко(соперник));
  const итог = сейчас === null ? '' : `<p class="hud-duel-shift">${сейчас >= 50 ? `Ведёт ${яК}` : `Ведёт ${онК}`}, ${Math.max(сейчас, 100 - сейчас)} из 100`
    + (Math.abs(сдвиг) >= 5 ? ` · <span class="${сдвиг > 0 ? 'is-me' : 'is-them'}">${сдвиг > 0 ? '◀' : '▶'} ${сдвиг > 0 ? яК : онК} отыграл(а) ${Math.abs(сдвиг)}</span>` : '') + `</p>`;
  let полоса = '';
  if (сейчас !== null && вид === 'scales') {
    // Весы: кто ведёт — та чаша тяжелее и ниже. Наклон до ±16°.
    // Коромысло поворачивается, чаши висят отвесно на его концах.
    const θ = (сейчас - 50) / 50 * -16 * Math.PI / 180;
    const лx = 80 - 54 * Math.cos(θ), лy = 18 - 54 * Math.sin(θ), пx = 80 + 54 * Math.cos(θ), пy = 18 + 54 * Math.sin(θ);
    const чаша = (x, y, имя, вес, кл) => `<g class="hud-duel-pan ${кл}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><line x1="0" y1="0" x2="-12" y2="20"/><line x1="0" y1="0" x2="12" y2="20"/><path d="M-16 20 Q0 31 16 20 Z"/><text class="w" y="17">${вес}</text><text y="40">${имя}</text></g>`;
    полоса = `<div class="hud-duel-scales" role="meter" aria-valuenow="${сейчас}" aria-valuemin="0" aria-valuemax="100" aria-label="Кто ведёт спор"><svg viewBox="0 0 160 92" aria-hidden="true">`
      + `<path class="base" d="M66 90 H94 L86 80 H74 Z"/><line class="post" x1="80" y1="80" x2="80" y2="18"/>`
      + `<line class="beam-line" x1="${лx.toFixed(1)}" y1="${лy.toFixed(1)}" x2="${пx.toFixed(1)}" y2="${пy.toFixed(1)}"/><circle class="pivot" cx="80" cy="18" r="3"/><path class="needle" d="M80 18 L${(80 + 12 * Math.sin(θ)).toFixed(1)} ${(18 - 12 * Math.cos(θ)).toFixed(1)}"/>`
      + `${чаша(лx, лy, яК, сейчас, 'is-me')}${чаша(пx, пy, онК, 100 - сейчас, 'is-them')}</svg></div>`;
  } else if (сейчас !== null && вид === 'chart') {
    // График: положение «моего» указателя по ходам спора, 50 — равенство.
    const ряд = [...прошлые].reverse().map(п => ({ v: положение(п, я), г: п.градус, назад: п.назад })).concat([{ v: сейчас, г: д.градус, назад: 0 }]).filter(т => т.v !== null);
    const W = 200, H = 64, шаг = ряд.length > 1 ? (W - 16) / (ряд.length - 1) : 0;
    const xy = ряд.map((т, i) => [8 + (ряд.length > 1 ? i * шаг : (W - 16) / 2), 6 + (100 - т.v) / 100 * (H - 12)]);
    const линия = xy.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
    const заливка = `${линия} L${xy[xy.length - 1][0].toFixed(1)} ${H / 2} L${xy[0][0].toFixed(1)} ${H / 2} Z`;
    полоса = `<div class="hud-duel-chart"><span class="hud-duel-chart-me">${яК} ведёт</span><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">`
      + `<line class="mid" x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}"/><path class="area" d="${заливка}"/><path class="line" d="${линия}"/>`
      + xy.map(([x, y], i) => `<circle class="${ряд[i].г >= 0 ? ГРАДУС[ряд[i].г][2] : ''}${i === xy.length - 1 ? ' is-now' : ''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i === xy.length - 1 ? 3.6 : 2.6}"><title>${ряд[i].назад ? ряд[i].назад + ' ход. назад' : 'сейчас'}: ${ряд[i].v >= 50 ? имяКоротко(я) : имяКоротко(соперник)} ${Math.max(ряд[i].v, 100 - ряд[i].v)}${ряд[i].г >= 0 ? ' · ' + ГРАДУС[ряд[i].г][0] : ''}</title></circle>`).join('')
      + `</svg><span class="hud-duel-chart-them">${онК} ведёт</span><small>${ряд.length} ${ряд.length === 1 ? 'ход' : ряд.length < 5 ? 'хода' : 'ходов'} спора</small></div>`;
  } else if (сейчас !== null) {
    полоса = `<div class="hud-duel-tug" role="meter" aria-valuenow="${сейчас}" aria-valuemin="0" aria-valuemax="100" aria-label="Кто ведёт спор">`
      + `<span class="hud-duel-track"><i class="hud-duel-mark" style="left:${100 - сейчас}%"></i>${было !== null ? `<i class="hud-duel-ghost" style="left:${100 - было}%"></i>` : ''}</span></div>`;
  }
  // Шапка: лицо против лица, у ведущего — свет и счёт крупно.
  const шапка = сейчас === null ? '' : `<div class="hud-duel-vs"><span class="hud-duel-who is-me${сейчас >= 50 ? ' is-lead' : ''}">${лицо(я)}<span><b>${яК}</b><em class="hud-v-num">${сейчас}</em></span></span>`
    + `${медаль('swords', 'is-lg hud-duel-vs-mid')}<span class="hud-duel-who is-them${сейчас < 50 ? ' is-lead' : ''}"><span><b>${онК}</b><em class="hud-v-num">${100 - сейчас}</em></span>${лицо(соперник)}</span></div>`;
  полоса = шапка + полоса + итог;
  const уступки = [{ ...д, назад: 0 }, ...прошлые].filter(x => x.уступка).map(x => `<span class="hud-duel-gv" title="${x.назад ? x.назад + ' ход. назад' : 'сейчас'}"><small>${x.назад ? '−' + x.назад : 'сейчас'}</small>${escapeHtml(x.уступка)}</span>`).join('');
  const градус = д.градус >= 0 ? `<div class="hud-duel-heat" aria-label="Градус: ${ГРАДУС[д.градус][0]}">${ГРАДУС.map(([слово, знак, кл], i) => `<span class="${кл}${i === д.градус ? ' is-now' : ''}${i < д.градус ? ' is-past' : ''}" title="${слово}">${ико(знак)}${i === д.градус ? слово : ''}</span>`).join('')}</div>` : (д.тон ? `<p class="hud-duel-tone">${escapeHtml(д.тон)}</p>` : '');
  // Накал по ходам: точки от первого хода спора к нынешнему.
  const накал = прошлые.some(п => п.градус >= 0) ? `<div class="hud-duel-heat-hist"><span>Накал по ходам</span>${[...прошлые].reverse().concat([д]).map(п => п.градус >= 0 ? `<i class="${ГРАДУС[п.градус][2]}" title="${п.назад ? п.назад + ' ход. назад' : 'сейчас'}: ${ГРАДУС[п.градус][0]}">${ико(ГРАДУС[п.градус][1])}</i>` : '<i class="is-none">·</i>').join('<b aria-hidden="true"></b>')}</div>` : '';
  const ход = c && typeof c.__hudХод === 'function' ? c.__hudХод() : null;
  // Только суть конфликта: уступка этого хода («подчинилась горловому
  // захвату») находила в памяти саму идущую сцену, а не прошлое спора.
  const суть = поле(c, 'Глубина конфликта').replace(/;\s*(?:dys|sg)\s*:.*$/i, '');
  // Всё, что пишется об этом ходе у персонажа, кроме самого спора.
  const идёт = Object.keys(c || {}).filter(к => !/конфликт|дуэль/i.test(к)).map(к => поле(c, к)).join(' ');
  const найдено = всплылоИзПамяти(суть, ход && ход.memory, идёт);
  const всплыло = найдено ? `<div class="hud-duel-past">${медаль('scroll')}<span><small>Всплыло из прошлого</small><p>${escapeHtml(найдено)}</p></span></div>` : '';
  return `<div class="hud-duel hud-v hud-v-card is-${вид}${д.градус >= 0 ? ' ' + ГРАДУС[д.градус][2] : ''}">${полоса}${градус}${накал}${уступки ? `<div class="hud-duel-gvs"><span>${ико('chain')}Уступки</span>${уступки}</div>` : ''}${всплыло}</div>`;
}
