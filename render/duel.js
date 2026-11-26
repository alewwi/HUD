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

import { имяДляВкладки } from '../utils.js?v=23.90.8';
import { escapeHtml, flattenFieldValue, снятьЗаглушки, имяБезПриставки, getSafeUserName } from '../utils.js?v=23.90.8';
import { namesLikelySame, упомянутВТексте } from '../names.js?v=23.90.8';
import { settings } from '../settings.js?v=23.90.8';
import { getAvatarUrl } from '../avatars.js?v=23.90.8';
import { ико, медаль } from './view-icons.js?v=23.90.8';

const текст = (v) => String(снятьЗаглушки(flattenFieldValue(v)) || '').trim();
const поле = (о, имя) => {
  if (!о || typeof о !== 'object') return '';
  const ключ = Object.keys(о).find(k => k.toLowerCase() === имя.toLowerCase());
  return ключ ? текст(о[ключ]) : '';
};
const пусто = (s) => !s || /^(empty|none|нет|—|-)$/i.test(String(s).trim());
// Приставка карточки («THE LANTERNS Damian Hartley») — и с двумя пробелами,
// как у Таверны, и с одним, как пишет модель: иначе соперником выходил «THE».
const имяКоротко = (имя) => имяДляВкладки(String(имя || '').replace(/^.*\s{2,}/, '')) || '';
const тот = (a, b) => !!(a && b && namesLikelySame(имяКоротко(a), имяКоротко(b)));

// Градус: от тёплого к горячему. Второе — линейный значок из view-icons.js.
export const ГРАДУС = [
  ['примирение', 'heart', 'is-peace'], ['холод', 'snow', 'is-cold'], ['спор', 'speech', 'is-argue'],
  ['укол', 'dagger', 'is-jab'], ['ссора', 'bolt', 'is-fight'], ['крик', 'megaphone', 'is-shout'],
];

// Слова тона по ступеням ГРАДУС (тот же порядок): «приказ» — властный холод,
// «допрос» и «угроза» — укол, «насилие», «удар», «ярость» — ссора.
const СИНОНИМЫ_ГРАДУСА = [
  /(?<![\p{L}])(?:примир|мир(?:ятся|имся|но)|нежн|тепл|прощ|reconcil|make up|making up|peace|tender|warm|forgiv)/iu,
  /(?<![\p{L}])(?:холод|ледян|отстран|молчан|игнор|приказ|доминац|доминир|триумф|властн|cold|icy|distant|silen|ignor|order|dominan|triumph|imperious)/iu,
  /(?<![\p{L}])(?:спор|препира|торг|возраж|argu|bicker|bargain|haggl|object|disput)/iu,
  /(?<![\p{L}])(?:укол|колк|язв|сарказ|насмеш|издёв|издев|допрос|угроз|шантаж|jab|barb|snide|sarcas|mock|taunt|interrog|threat|blackmail)/iu,
  /(?<![\p{L}])(?:ссор|ярост|гнев|злост|насил|удар|драк|бешен|quarrel|fury|furious|rage|anger|angry|violen|hit|blow|fight|brawl)/iu,
  /(?<![\p{L}])(?:крик|орёт|орет|вопл|рык|рёв|рев(?![\p{L}])|shout|yell|scream|roar)/iu,
];

// Лицо спорщика: аватарка карточки или буква на акценте (как в сетке секретов).
function лицо(имя, кл = '') {
  let url = '';
  try { url = (getAvatarUrl(имя) || {}).thumbUrl || (getAvatarUrl(имя) || {}).url || ''; } catch (_) { url = ''; }
  const буква = escapeHtml((имяКоротко(имя).match(/\p{L}/u) || ['?'])[0].toUpperCase());
  return `<span class="hud-v-face hud-duel-face${кл}"${url ? ` style="background-image:url('${String(url).replace(/'/g, '%27')}')"` : ''}>${url ? '' : буква}</span>`;
}

/** «ini: Мари, 70; gv: Дамиан уступил в деньгах; tn: ссора» → разбор. */
export function разобратьДуэль(value) {
  const s = текст(value);
  if (пусто(s)) return null;
  const ч = {};
  s.split(';').forEach(x => { const м = x.match(/^\s*(ini|gv|tn|tone?)\s*[:：]\s*(.+)$/i); if (м) ч[/^ton/i.test(м[1]) ? 'tn' : м[1].toLowerCase()] = м[2].trim(); });
  if (!ч.ini && !ч.gv && !ч.tn) return null;
  const м = String(ч.ini || '').match(/^(.*?)[,:—–-]?\s*(\d{1,3})\s*%?\s*$/);
  let ведёт = м ? м[1].replace(/[,:—–-]\s*$/, '').trim() : String(ч.ini || '').trim();
  let сила = м ? Math.max(0, Math.min(100, +м[2])) : null;
  // «ini: паритет 50», «ничья», «equal» — никто не ведёт: это не имя
  // соперника, а равенство сил.
  if (/^(?:паритет|равенство|равны|поровну|ничья|никто|нейтрально|parity|equal(?:ly)?|even|tie|draw|nobody|none|neutral)$/i.test(ведёт)) { ведёт = ''; сила = 50; }
  // «холод | укол | приказ» — модель называет несколько тонов: берём самый
  // горячий из названных. Слова вне списка — по синонимам ступеней.
  const тон = String(ч.tn || '');
  const градус = СИНОНИМЫ_ГРАДУСА.reduce((выше, rx, i) => (rx.test(тон) ? i : выше), -1);
  return { ведёт, сила, уступка: пусто(ч.gv) ? '' : ч.gv, градус, тон: ч.tn || '' };
}

// Положение указателя для персонажа: 100 — он полностью ведёт.
const положение = (д, имя) => (д && д.сила !== null ? (тот(д.ведёт, имя) ? д.сила : 100 - д.сила) : null);

// Суть конфликта (X) без счётчика дней и стадии.
const сутьКонфликта = (о) => поле(о, 'Глубина конфликта').replace(/;\s*(?:dys|sg)\s*:.*$/i, '');
// Кто назван в начале уступки: «Мари уступила…». Приставку карточки
// капсом («THE LANTERNS Damian Hartley признал…») пропускаем — иначе
// соперником выходил «THE».
const кто = (уступка) => (String(уступка || '').match(/^(?:[\p{Lu}\d]{2,}\s+)*([\p{Lu}][\p{Ll}][\p{L}-]*)/u) || [])[1] || '';
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
  // Прошлые ходы того же спора — подряд, пока Vd был. Vd идёт ход за ходом
  // и через смену спора: в живом чате спор с Дареном под стволом сразу
  // перетёк в спор с Мари о таблетке, а утренний спор с Мари о завтраке — в
  // косу Инес. Склеенные, они давали «+100 в пользу Дамиана» и чужие
  // уступки. Спор кончился, если сменился соперник или у сути конфликта
  // (X) не осталось ни одного общего корня с соседним ходом.
  const соперникХода = (п) => [п.ведёт, кто(п.уступка)].find(n => n && !тот(n, я)) || '';
  const корни = (s) => new Set([...значимые(s)].map(w => w.slice(0, Math.min(5, w.length - 1))));
  const тотЖеСпор = (а, б) => { const А = корни(а), Б = корни(б); return А.size < 2 || Б.size < 2 || [...А].some(w => Б.has(w)); };
  let враг = соперникХода(д), сутьБлиже = сутьКонфликта(c);
  const прошлые = [];
  for (const х of история) {
    const п = разобратьДуэль(поле(х.данные, 'Словесная дуэль'));
    if (!п) break;
    const врагТам = соперникХода(п), сутьТам = сутьКонфликта(х.данные);
    if ((враг && врагТам && !тот(враг, врагТам)) || !тотЖеСпор(сутьБлиже, сутьТам)) break;
    прошлые.push({ ...п, назад: х.назад });
    враг = враг || врагТам;
    сутьБлиже = сутьТам || сутьБлиже;
  }
  // Соперник, по порядку: кто вёл в каком-то ходе; кто назван в уступке
  // («Дориану и Феликсу пришлось…» — к имени из сцены, в именительном);
  // тот, у кого в этом же HUD свой Vd про спор со мной (Феликс: «ini:
  // Мирабель»); кто назван в сути конфликта; игрок, если он в сцене.
  // Первый попавшийся сосед — не соперник: у Мирабели им выходил
  // двухлетний Нико из другого города.
  const люди = (c && Array.isArray(c.__соседи) ? c.__соседи : []).filter(п => п && п.имя && !тот(п.имя, я));
  const изСцены = (n) => (n ? (люди.find(п => тот(п.имя, n)) || {}).имя || '' : '');
  const изУступок = [д, ...прошлые].map(x => изСцены(кто(x.уступка))).find(Boolean);
  const встречный = (люди.find(п => { const о = разобратьДуэль(поле(п.данные, 'Словесная дуэль')); return о && [о.ведёт, кто(о.уступка)].some(n => n && тот(n, я)); }) || {}).имя;
  const вСути = (люди.find(п => упомянутВТексте(сутьКонфликта(c), имяКоротко(п.имя))) || {}).имя;
  const игрок = (люди.find(п => тот(п.имя, getSafeUserName())) || {}).имя;
  const ведущий = [д, ...прошлые].map(x => x.ведёт).find(n => n && !тот(n, я));
  const соперник = (ведущий && (изСцены(ведущий) || ведущий)) || изУступок || встречный || вСути || игрок || 'собеседник';
  // В тексте уступок — имена без приставки карточки: «THE CROWNS Dorian
  // Hale уступил…» → «Dorian Hale уступил…».
  const безПриставок = (t) => [я, ...люди.map(п => п.имя)].reduce((т, имя) => {
    const полное = String(имя || '').trim(), короткое = имяБезПриставки(полное);
    if (!полное || короткое === полное.replace(/\s+/g, ' ')) return т;
    return т.replace(new RegExp(полное.split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'), 'g'), короткое);
  }, String(t || ''));
  const сейчас = положение(д, я), было = прошлые.length ? положение(прошлые[0], я) : null;
  const сдвиг = сейчас !== null && было !== null ? сейчас - было : 0;
  const вид = ['tug', 'scales', 'chart', 'clash', 'stage'].includes(settings.duelView) ? settings.duelView : 'tug';
  const яК = escapeHtml(имяКоротко(я)), онК = escapeHtml(имяКоротко(соперник));
  const итог = сейчас === null ? '' : `<p class="hud-duel-shift">${сейчас >= 50 ? `Ведёт ${яК}` : `Ведёт ${онК}`}, ${Math.max(сейчас, 100 - сейчас)} из 100`
    + (Math.abs(сдвиг) >= 5 ? ` · <span class="${сдвиг > 0 ? 'is-me' : 'is-them'}">${сдвиг > 0 ? '◀' : '▶'} +${Math.abs(сдвиг)} в пользу ${сдвиг > 0 ? яК : онК}</span>` : '') + `</p>`;
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
  const уступки = [{ ...д, назад: 0 }, ...прошлые].filter(x => x.уступка).map(x => `<span class="hud-duel-gv" title="${x.назад ? x.назад + ' ход. назад' : 'сейчас'}"><small>${x.назад ? '−' + x.назад : 'сейчас'}</small>${escapeHtml(безПриставок(x.уступка))}</span>`).join('');
  const градус = д.градус >= 0 ? `<div class="hud-duel-heat" aria-label="Градус: ${ГРАДУС[д.градус][0]}">${ГРАДУС.map(([слово, знак, кл], i) => `<span class="${кл}${i === д.градус ? ' is-now' : ''}${i < д.градус ? ' is-past' : ''}" title="${слово}">${ико(знак)}${i === д.градус ? слово : ''}</span>`).join('')}</div>` : (д.тон ? `<p class="hud-duel-tone">${escapeHtml(д.тон)}</p>` : '');
  // Накал по ходам: точки от первого хода спора к нынешнему.
  const накал = прошлые.some(п => п.градус >= 0) ? `<div class="hud-duel-heat-hist"><span>Накал по ходам</span>${[...прошлые].reverse().concat([д]).map(п => п.градус >= 0 ? `<i class="${ГРАДУС[п.градус][2]}" title="${п.назад ? п.назад + ' ход. назад' : 'сейчас'}: ${ГРАДУС[п.градус][0]}">${ико(ГРАДУС[п.градус][1])}</i>` : '<i class="is-none">·</i>').join('<b aria-hidden="true"></b>')}</div>` : '';
  const ход = c && typeof c.__hudХод === 'function' ? c.__hudХод() : null;
  // Только суть конфликта: уступка этого хода («подчинилась горловому
  // захвату») находила в памяти саму идущую сцену, а не прошлое спора.
  const суть = сутьКонфликта(c);
  // Всё, что пишется об этом ходе у персонажа, кроме самого спора.
  const идёт = Object.keys(c || {}).filter(к => !/конфликт|дуэль/i.test(к)).map(к => поле(c, к)).join(' ');
  const найдено = всплылоИзПамяти(суть, ход && ход.memory, идёт);
  const всплыло = найдено ? `<div class="hud-duel-past">${медаль('scroll')}<span><small>Всплыло из прошлого</small><p>${escapeHtml(найдено)}</p></span></div>` : '';
  if (вид === 'clash' || вид === 'stage') {
    const о = { д, прошлые, сейчас, было, сдвиг, я, соперник, яК, онК, безПриставок };
    return `<div class="hud-duel hud-v hud-v-card is-${вид}${д.градус >= 0 ? ' ' + ГРАДУС[д.градус][2] : ''}">${вид === 'clash' ? столкновение(о) : сцена(о)}${всплыло}</div>`;
  }
  return `<div class="hud-duel hud-v hud-v-card is-${вид}${д.градус >= 0 ? ' ' + ГРАДУС[д.градус][2] : ''}">${полоса}${градус}${накал}${уступки ? `<div class="hud-duel-gvs"><span>${ико('chain')}Уступки</span>${уступки}</div>` : ''}${всплыло}</div>`;
}


/* =========================================================================
   Виды «Столкновение» и «Дебаты» (duelView). Те же данные, что у каната:
   кто ведёт и насколько, сдвиг с прошлого хода, уступки, накал по ходам —
   но каждая метафора показывает их своими вещами.
   ========================================================================= */
const ходНазад = (н) => (н ? '−' + н : 'сейчас');
// Кто сдал позицию: уступка названа по имени — сдал тот, кто назван.
const ктоОтдал = (уступка, я) => { const к = кто(уступка); return к ? (тот(к, я) ? 'me' : 'them') : ''; };
// Детерминированный «случай»: одинаковый спор рисуется одинаково.
const зерно = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const случай = (z, i) => { const x = Math.sin(z * 0.0001 + i * 12.9898) * 43758.5453; return x - Math.floor(x); };
const ф1 = (x) => Math.round(x * 10) / 10;

/* --- Столкновение: две ауры давят друг на друга --------------------------
   Поле — ночь. Слева сияние «моей» стороны, справа — соперника; граница
   там, куда дожал ведущий. Шов — молния: чем горячее спор, тем шире зубцы
   и больше искр. Пунктир — где шов был ходом раньше, стрелка — куда и
   насколько его сдвинули. Уступки — осколки, отколотые от сдавшего.
   Накал по ходам — полоса спектра. */
function столкновение({ д, прошлые, сейчас, было, сдвиг, я, соперник, яК, онК, безПриставок }) {
  const неясно = сейчас === null, п = неясно ? 50 : сейчас;
  const W = 320, H = 136, z = зерно(я + '|' + соперник + '|' + прошлые.length);
  const id = 'dc' + z.toString(36);
  const шов = ф1(W * Math.max(10, Math.min(90, п)) / 100);
  const г = д.градус >= 0 ? д.градус : 2;
  const амп = 2.5 + г * 2.6;
  // Молния: точки сверху вниз, зубцы влево-вправо.
  const N = 12;
  const точки = Array.from({ length: N + 1 }, (_, i) => [i === 0 || i === N ? шов : ф1(шов + (i % 2 ? 1 : -1) * амп * (.45 + случай(z, i) * .55)), ф1(i * H / N)]);
  const линия = точки.map(([x, y], i) => (i ? 'L' : 'M') + x + ' ' + y).join('');
  const лево = `M0 0${точки.map(([x, y]) => 'L' + x + ' ' + y).join('')}L0 ${H}Z`;
  const право = `M${W} 0${точки.map(([x, y]) => 'L' + x + ' ' + y).join('')}L${W} ${H}Z`;
  const искры = Array.from({ length: 6 + г * 3 }, (_, k) => {
    const y = ф1(6 + случай(z, k + 40) * (H - 12)), x = ф1(шов + (случай(z, k + 80) - .5) * (16 + г * 9)), r = ф1(.7 + случай(z, k + 120) * (1 + г * .25));
    return `<circle class="spark s${k % 3}" cx="${x}" cy="${y}" r="${r}"/>`;
  }).join('');
  // Звёзды фона: неподвижные, как у ночного неба.
  const звёзды = Array.from({ length: 26 }, (_, k) => `<circle class="star" cx="${ф1(случай(z, k + 200) * W)}" cy="${ф1(случай(z, k + 260) * H)}" r="${ф1(.3 + случай(z, k + 320) * .7)}"/>`).join('');
  const прежде = было === null ? '' : (() => { const x = ф1(W * Math.max(10, Math.min(90, было)) / 100); return Math.abs(x - шов) < 6 ? '' : `<path class="was" d="M${x} 8V${H - 8}"><title>было</title></path>`; })();
  const стрелка = неясно || Math.abs(сдвиг) < 5 ? '' : (() => { const к = сдвиг > 0 ? 1 : -1, y = 18, x1 = ф1(шов - к * 34), x2 = ф1(шов - к * 9);
    return `<path class="push" d="M${x1} ${y}L${x2} ${y}M${ф1(x2 - к * 5)} ${y - 4}L${x2} ${y}L${ф1(x2 - к * 5)} ${y + 4}"/><text class="push-l" x="${ф1((x1 + x2) / 2)}" y="${y - 6}">+${Math.abs(сдвиг)}</text>`; })();
  const поле = `<svg class="field" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs>`
    + `<linearGradient id="${id}-l" x1="0" x2="1"><stop class="l0" offset="0"/><stop class="l1" offset=".72"/><stop class="l2" offset="1"/></linearGradient>`
    + `<linearGradient id="${id}-r" x1="1" x2="0"><stop class="r0" offset="0"/><stop class="r1" offset=".72"/><stop class="r2" offset="1"/></linearGradient>`
    + `<filter id="${id}-g" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="3.2"/></filter></defs>`
    + `<rect class="night" width="${W}" height="${H}"/>${звёзды}<path class="aura is-me" d="${лево}" fill="url(#${id}-l)"/><path class="aura is-them" d="${право}" fill="url(#${id}-r)"/>`
    + `${прежде}<path class="bolt-glow" d="${линия}" filter="url(#${id}-g)"/><path class="bolt" d="${линия}"/><path class="bolt-core" d="${линия}"/>${искры}${стрелка}</svg>`;
  const сторона = (кл, имя, К, доля, ведёт) => `<span class="side ${кл}${ведёт ? ' is-lead' : ''}">${лицо(имя)}<b>${К}</b><em class="hud-v-num">${неясно ? '—' : доля}</em></span>`;
  const тон = д.градус >= 0 ? `<span class="tone">${ико(ГРАДУС[д.градус][1])}${ГРАДУС[д.градус][0]}</span>` : '';
  const арена = `<div class="hud-clash-arena" role="meter" aria-valuenow="${п}" aria-valuemin="0" aria-valuemax="100" aria-label="Кто ведёт спор">${поле}`
    + `${сторона('is-me', я, яК, п, !неясно && п > 50)}${сторона('is-them', соперник, онК, 100 - п, !неясно && п < 50)}${тон}</div>`;
  const ведёт = п > 50 ? яК : онК, уступает = п > 50 ? онК : яК;
  const итог = неясно ? '<span>Расклад неясен</span>'
    : Math.abs(сдвиг) >= 5 ? `<b>${сдвиг > 0 ? яК : онК}</b><span>теснит</span><b>${сдвиг > 0 ? онК : яК}</b>`
    : п === 50 ? '<span>Силы равны</span>' : `<b>${ведёт}</b><span>держит верх над</span><b>${уступает}</b>`;
  const осколок = '<svg class="shard" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2 13 5 9 14 4 9Z"/><path class="hi" d="M3 2 9 7 4 9Z"/></svg>';
  const осколки = [{ ...д, назад: 0 }, ...прошлые].filter(x => x.уступка).map(x => { const к = ктоОтдал(x.уступка, я); return `<li class="${к ? 'from-' + к : ''}">${осколок}<small>${ходНазад(x.назад)}</small><span>${escapeHtml(безПриставок(x.уступка))}</span></li>`; }).join('');
  const ходы = [...прошлые].reverse().concat([д]);
  const спектр = ходы.length > 1 && ходы.some(x => x.градус >= 0) ? `<div class="hud-clash-spectrum"><small>Накал по ходам</small><span class="bar">${ходы.map((x, i) => `<i class="${x.градус >= 0 ? 'g' + x.градус : 'is-none'}${i === ходы.length - 1 ? ' is-now' : ''}" title="${ходНазад(x.назад)}${x.градус >= 0 ? ': ' + ГРАДУС[x.градус][0] : ''}"></i>`).join('')}</span></div>` : '';
  return `<div class="hud-clash g${г}">${арена}<p class="hud-clash-say">${итог}</p>${осколки ? `<div class="hud-clash-shards"><small>Осколки уступок</small><ul>${осколки}</ul></div>` : ''}${спектр}</div>`;
}

/* --- Дебаты: сцена, прожекторы, трибуны, стрелка аплодисментов ----------
   Бархатный занавес, у каждого спорщика — трибуна с латунной табличкой и
   свой прожектор: чем больше доля спора, тем ярче свет. Посередине —
   стрелочный прибор «на чьей стороне зал». Свет сцены окрашен накалом.
   Сданные позиции — карточки-подсказки, перечёркнутые красным; ниже —
   как зал качался по ходам. */
function сцена({ д, прошлые, сейчас, было, сдвиг, я, соперник, яК, онК, безПриставок }) {
  const неясно = сейчас === null, п = неясно ? 50 : сейчас;
  const свет = (доля) => (.22 + доля / 100 * .78).toFixed(2);
  // Стрелка: к трибуне ведущего, до ±62°.
  const угол = (x) => (50 - x) / 50 * 62;
  const ст = (a, r) => { const t = (a - 90) * Math.PI / 180; return [ф1(60 + r * Math.cos(t)), ф1(62 + r * Math.sin(t))]; };
  const дугаП = (a1, a2, r) => { const [x1, y1] = ст(a1, r), [x2, y2] = ст(a2, r); return `M${x1} ${y1}A${r} ${r} 0 0 1 ${x2} ${y2}`; };
  const засечки = Array.from({ length: 13 }, (_, i) => { const a = -60 + i * 10, [x1, y1] = ст(a, 43), [x2, y2] = ст(a, i % 3 ? 47 : 50); return `<path class="tk" d="M${x1} ${y1}L${x2} ${y2}"/>`; }).join('');
  const [nx, ny] = ст(угол(п), 44);
  const прежде = было === null || Math.abs(было - п) < 3 ? '' : (() => { const [bx, by] = ст(угол(было), 40); return `<path class="was" d="M60 62L${bx} ${by}"/>`; })();
  const прибор = `<svg class="gauge" viewBox="0 0 120 72" aria-hidden="true"><path class="face" d="M8 66A52 52 0 0 1 112 66Z"/>`
    + `<path class="arc is-me" d="${дугаП(-60, -2, 46)}"/><path class="arc is-them" d="${дугаП(2, 60, 46)}"/>${засечки}`
    + `<text class="end is-me" x="16" y="64">${яК.slice(0, 1)}</text><text class="end is-them" x="104" y="64">${онК.slice(0, 1)}</text>`
    + `${прежде}<path class="needle" d="M60 62L${nx} ${ny}"/><circle class="hub" cx="60" cy="62" r="4"/></svg>`;
  const трибуна = (кл, имя, К, доля, ведёт) => `<div class="podium ${кл}${ведёт ? ' is-lead' : ''}">${лицо(имя)}<span class="desk"><span class="plate"><b>${К}</b><em class="hud-v-num">${неясно ? '—' : доля}</em></span></span></div>`;
  const зал = неясно ? '' : п === 50 ? 'поровну' : (п > 50 ? яК : онК);
  const подмостки = `<div class="hud-stage-box" style="--lm:${свет(п)};--lt:${свет(100 - п)}" role="meter" aria-valuenow="${п}" aria-valuemin="0" aria-valuemax="100" aria-label="Кто ведёт спор">`
    + `<i class="valance" aria-hidden="true"></i><i class="curtain is-l" aria-hidden="true"></i><i class="curtain is-r" aria-hidden="true"></i>`
    + `<i class="beam is-me" aria-hidden="true"></i><i class="beam is-them" aria-hidden="true"></i><i class="boards" aria-hidden="true"></i>`
    + `${трибуна('is-me', я, яК, п, !неясно && п > 50)}<div class="meter">${прибор}${зал ? `<small>Зал за</small><b>${зал}</b>` : '<small>Зал молчит</small>'}</div>${трибуна('is-them', соперник, онК, 100 - п, !неясно && п < 50)}`
    + `${д.градус >= 0 ? `<span class="marquee">${ико(ГРАДУС[д.градус][1])}${ГРАДУС[д.градус][0]}</span>` : ''}</div>`;
  const итог = неясно ? '<span>Зал ещё не решил</span>'
    : Math.abs(сдвиг) >= 5 ? `<b>${сдвиг > 0 ? яК : онК}</b><span>перетягивает зал:</span><em>+${Math.abs(сдвиг)}</em>`
    : п === 50 ? '<span>Зал разделился поровну</span>' : `<b>${п > 50 ? яК : онК}</b><span>держит зал</span>`;
  const карточки = [{ ...д, назад: 0 }, ...прошлые].filter(x => x.уступка).map(x => { const к = ктоОтдал(x.уступка, я); return `<li class="cue${к ? ' by-' + к : ''}"><small>${ходНазад(x.назад)}</small><span>${escapeHtml(безПриставок(x.уступка))}</span><i class="strike" aria-hidden="true"></i></li>`; }).join('');
  const ходы = [...прошлые].reverse().concat([д]).map(x => ({ v: положение(x, я), г: x.градус, назад: x.назад || 0 }));
  const качели = ходы.length > 1 && ходы.some(x => x.v !== null) ? `<div class="hud-stage-sway"><small>Зал по ходам</small><span class="eq">${ходы.map((x, i) => { const v = x.v === null ? 50 : x.v, h = Math.round(Math.min(100, Math.max(14, Math.abs(v - 50) * 3.2)));
    return `<i class="${v >= 50 ? 'up' : 'down'}${x.г >= 0 ? ' g' + x.г : ''}${i === ходы.length - 1 ? ' is-now' : ''}" style="--bh:${h}%" title="${ходНазад(x.назад)}: ${v >= 50 ? имяКоротко(я) : имяКоротко(соперник)} ${Math.max(v, 100 - v)}${x.г >= 0 ? ' · ' + ГРАДУС[x.г][0] : ''}"></i>`; }).join('')}</span></div>` : '';
  return `<div class="hud-stage">${подмостки}<p class="hud-stage-say">${итог}</p>${карточки ? `<div class="hud-stage-cues"><small>Сданные позиции</small><ul>${карточки}</ul></div>` : ''}${качели}</div>`;
}
