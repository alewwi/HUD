// hud-manager/render/extras.js
//
// Новые блоки карточки: фаза луны в сцене, титры в конце, состояние тела,
// поворот сюжета, спутник карточкой и тамагочи. Всё здесь — чистые функции
// «данные → разметка»; оформление живёт в css/extras.css.

import { escapeHtml, hudHasMeaningfulValue, инициалыИмени } from '../utils.js?v=23.89.55';
import { settings } from '../settings.js?v=23.89.55';
import { аватаркаПоИмени } from './views.js?v=23.89.55';
import { магияВМире } from '../era.js?v=23.89.55';
import { реальныйПортрет } from './pet-real.js?v=23.89.55';

// Умения спутника — не больше четырёх: модель копит их ходами, и в карточке
// выстраивалась стена пилюль. Короткие (до шести слов) — вперёд, в порядке
// модели; длинные истории — только если коротких не хватило.
export const УМЕНИЙ_СПУТНИКА = 4;
export function лучшиеУмения(текст, n = УМЕНИЙ_СПУТНИКА) {
  const все = [...new Set(String(текст ?? '').split(/[;\n]/).map(s => s.trim()).filter(Boolean))];
  const коротко = (у) => у.split(/\s+/).length <= 6;
  const выбор = [...все.filter(коротко), ...все.filter(у => !коротко(у))].slice(0, n);
  return все.filter(у => выбор.includes(у));
}

const есть = (v) => hudHasMeaningfulValue(v) && !/^(empty|none|null|нет|пусто)$/i.test(String(v).trim());
const огр = (v, a, b) => Math.max(a, Math.min(b, v));
const число = (s) => { const m = String(s ?? '').replace(',', '.').match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };

// ---------------------------------------------------------------------------
// ФАЗА ЛУНЫ
// ---------------------------------------------------------------------------
// Считается по игровой дате: новолуние 06.01.2000 18:14 UTC и синодический
// месяц. Дата в чужом календаре (фэнтези, «3-й день Жатвы») не разбирается —
// тогда фазы просто нет.
const НОВОЛУНИЕ = Date.UTC(2000, 0, 6, 18, 14);
const СИНОДИЧЕСКИЙ = 29.530588853;
export function датаИзСтроки(строка) {
  const s = String(строка || '');
  let m = s.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1], 12);
  m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], 12);
  return NaN;
}
export function фазаЛуны(строкаДаты) {
  const t = датаИзСтроки(строкаДаты);
  if (!Number.isFinite(t)) return null;
  const дни = (t - НОВОЛУНИЕ) / 86400000;
  const p = ((дни / СИНОДИЧЕСКИЙ) % 1 + 1) % 1;
  const свет = Math.round((1 - Math.cos(2 * Math.PI * p)) / 2 * 100);
  const имя = p < 0.03 || p > 0.97 ? 'Новолуние' : p < 0.22 ? 'Молодая луна' : p < 0.28 ? 'Первая четверть'
    : p < 0.47 ? 'Растущая луна' : p < 0.53 ? 'Полнолуние' : p < 0.72 ? 'Убывающая луна' : p < 0.78 ? 'Последняя четверть' : 'Старая луна';
  return { p, свет, имя, день: Math.floor(p * СИНОДИЧЕСКИЙ) + 1 };
}
// Лунный диск: освещённая часть — полукруг плюс эллипс терминатора.
export function лунаSvg(p, r = 10, свет = '#f4ecd0', тень = 'rgba(255,255,255,.12)') {
  const k = Math.cos(2 * Math.PI * p), rx = (r * Math.abs(k)).toFixed(2);
  const d = p < 0.5
    ? `M0 ${-r}A${r} ${r} 0 0 1 0 ${r}A${rx} ${r} 0 0 ${k > 0 ? 0 : 1} 0 ${-r}Z`
    : `M0 ${-r}A${r} ${r} 0 0 0 0 ${r}A${rx} ${r} 0 0 ${k > 0 ? 1 : 0} 0 ${-r}Z`;
  return `<svg viewBox="${-r - 1} ${-r - 1} ${2 * r + 2} ${2 * r + 2}" aria-hidden="true"><circle r="${r}" fill="${тень}" stroke="rgba(255,255,255,.25)" stroke-width=".6"/><path d="${d}" fill="${свет}"/></svg>`;
}
const ФАЗЫ = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];
export function чипЛуны(строкаДаты) {
  if (settings.moonPhase === false) return '';
  const ф = фазаЛуны(строкаДаты);
  if (!ф) return '';
  const ближняя = ФАЗЫ.reduce((a, b) => Math.min(Math.abs(b - ф.p), 1 - Math.abs(b - ф.p)) < Math.min(Math.abs(a - ф.p), 1 - Math.abs(a - ф.p)) ? b : a);
  return `<div class="hud-moonchip" title="${ф.имя}: ${ф.день}-й день лунного цикла, освещено ${ф.свет}%">`
    + `<span class="hud-moonchip-big">${лунаSvg(ф.p, 14)}</span><span class="hud-moonchip-txt"><b>${ф.имя}</b><small>${ф.день}-й день цикла · освещено ${ф.свет}%</small></span>`
    + `<span class="hud-moonchip-row">${ФАЗЫ.map(p => `<i class="${p === ближняя ? 'on' : ''}">${лунаSvg(p, 8)}</i>`).join('')}</span></div>`;
}
// Тень на луне в небе сцены: ширина тёмного серпа в пикселях диска 54px,
// знак — с какой стороны (растущая светит справа, тень слева).
export function теньЛуны(строкаДаты) {
  if (settings.moonPhase === false) return '';
  const ф = фазаЛуны(строкаДаты);
  if (!ф) return '';
  const тёмная = (1 - ф.свет / 100) * 54;
  // Освещённость 0..1: в новолуние луна в небе почти не видна, а не чёрный диск.
  return `--moon-dark:${(ф.p < 0.5 ? 1 : -1) * Math.round(тёмная)}px;--moon-lit:${(ф.свет / 100).toFixed(2)};`;
}

// ---------------------------------------------------------------------------
// ТИТРЫ В КОНЦЕ СЦЕНЫ
// ---------------------------------------------------------------------------
export function титрыСцены({ имена = [], место = '', время = '', дата = '', игрок = '' } = {}) {
  if (settings.sceneCredits !== 'on') return '';
  const люди = [...new Set(имена.filter(есть).map(String))];
  if (!люди.length) return '';
  const штрих = (время || '0000').replace(/\D/g, '').split('').map(ц => `<i style="width:${1 + (+ц % 3)}px"></i>`).join('');
  return `<div class="hud-credits"><div class="hud-credits-end">— конец сцены —</div>`
    + `<div class="hud-credits-cast"><span>В ролях</span>${люди.map(и => `<b>${escapeHtml(и)}</b>`).join('')}</div>`
    + (есть(место) ? `<div class="hud-credits-cast"><span>Место съёмки</span><b>${escapeHtml(место)}</b></div>` : '')
    + (есть(игрок) ? `<div class="hud-credits-cast"><span>Сценарий</span><b>${escapeHtml(игрок)}</b></div>` : '')
    + `<div class="hud-credits-foot">${есть(время) ? `<span class="hud-credits-inv">${escapeHtml(время)}</span>` : '<span></span>'}<span class="hud-credits-code">${штрих}${штрих}</span><span>${escapeHtml(дата || '')}</span></div></div>`;
}

// ---------------------------------------------------------------------------
// СОСТОЯНИЕ ТЕЛА (Bs)
// ---------------------------------------------------------------------------
// 'Энергия: 35 — на исходе; Бодрость: 20 — не выспалась; Сытость: 30 — голодна;
//  Стресс: 80 — на пределе; Сон: 4 ч 10 мин, легла в 03:20; Дела: пары в 09:00'
const ШКАЛЫ = [
  { к: 'energy', rx: /энерг|^eng|energy/i, имя: 'Энергия', c: '#f2c14e' },
  { к: 'awake', rx: /бодр|сонлив|^awk|alert|wakeful|sleepiness/i, имя: 'Бодрость', c: '#6fb7ff' },
  { к: 'food', rx: /сыт|голод|^sat|hunger|fullness|satiety/i, имя: 'Сытость', c: '#f08a4b' },
  { к: 'stress', rx: /стресс|напряж|^str|tension/i, имя: 'Стресс', c: '#ef5a6e' },
  // Мана (render/powers.js) — только когда в мире есть магия; иначе метка уходит в заметку.
  { к: 'mana', rx: /^мана|^mn$|^mana/i, имя: 'Мана', c: '#7fd6cf', фэнтези: true },
];
// «1.5 часа поверхностного сна», «4 ч 10 мин», «не спал» — часы сна; null — не понять.
export function часыСна(т) {
  const s = String(т || '').toLowerCase();
  if (!s) return null;
  if (/(?<![\p{L}])(?:не спал\p{L}*|без сна|глаз не сомкну\p{L}*|didn'?t sleep|no sleep|sleepless)/iu.test(s)) return 0;
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(?:ч(?![\p{L}])|час\p{L}*|h(?![\p{L}])|hours?|hrs?)(?:\s*(\d{1,2})\s*(?:мин|min))?/u);
  if (!m) return null;
  return Math.round((parseFloat(m[1].replace(',', '.')) + (m[2] ? +m[2] / 60 : 0)) * 10) / 10;
}
export function разобратьСостояниеТела(value) {
  const шкалы = [], текст = { сон: '', дела: '', прочее: [] };
  String(value || '').split(/;|\n/).map(s => s.trim()).filter(Boolean).forEach(часть => {
    const m = часть.match(/^([^:]{1,24}):\s*(.+)$/);
    const метка = m ? m[1].trim() : '', тело = m ? m[2].trim() : часть;
    const ш = ШКАЛЫ.find(x => x.rx.test(метка) && (!x.фэнтези || магияВМире()));
    if (ш) {
      const n = число(тело);
      const слово = тело.replace(/^\s*-?\d+(?:[.,]\d+)?\s*%?\s*[—–:-]?\s*/, '').trim();
      if (Number.isFinite(n)) шкалы.push({ ...ш, v: огр(Math.round(n), 0, 100), слово });
      return;
    }
    if (/^сон|^slp|sleep/i.test(метка)) текст.сон = тело;
    // «slp: 1.5 h; 5 nights: 9 h» — хвост про несколько ночей идёт ко сну, а не в заметку.
    else if (текст.сон && /^\d{1,2}\s*(?:ноч|сут|дн|night|day)/iu.test(метка)) текст.сон += '; ' + часть;
    else if (/^дел|^dut|работ|учёб|учеб|work|duties|school|study|classes/i.test(метка)) текст.дела = тело;
    else текст.прочее.push(часть);
  });
  ШКАЛЫ.forEach((ш, i) => { const н = шкалы.findIndex(x => x.к === ш.к); if (н > -1) шкалы[н].i = i; });
  шкалы.sort((a, b) => a.i - b.i);
  // Сон прошлой ночью против бодрости и энергии: «1,5 часа сна» и «бодрость 100»
  // не сходятся — HUD это помечает (числа пишет модель, сверяет HUD).
  const часы = часыСна(текст.сон);
  if (часы !== null && часы <= 4) for (const ш of шкалы) if ((ш.к === 'awake' || ш.к === 'energy') && ш.v >= 75) ш.спор = `после ${String(часы).replace('.', ',')} ч сна?`;
  return { шкалы, ...текст, часыСна: часы };
}
let счёт = 0;
const нид = (п) => `hud-bs-${п}-${(++счёт).toString(36)}`;
const ЛУНА_СНА = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" fill="#c9d6ff"/><circle cx="18" cy="5" r="1" fill="#fff"/><circle cx="21" cy="9" r=".7" fill="#fff"/></svg>';
function батарейка(s) {
  const id = нид('b'), h = 44 * s.v / 100;
  return `<div class="hud-bs-cell" style="--c:${s.c}"><svg viewBox="0 0 30 56" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${s.c}" stop-opacity=".75"/><stop offset=".45" stop-color="#fff" stop-opacity=".9"/><stop offset=".6" stop-color="${s.c}"/><stop offset="1" stop-color="${s.c}" stop-opacity=".7"/></linearGradient></defs>`
    + `<rect class="cap" x="10" y="0" width="10" height="4" rx="1.5"/><rect class="shell" x="2" y="4" width="26" height="50" rx="6"/>`
    + `<rect x="5" y="${(51 - h).toFixed(1)}" width="20" height="${h.toFixed(1)}" rx="3" fill="url(#${id})"/>`
    + [15, 26, 37].map(y => `<line class="seg" x1="5" x2="25" y1="${y}" y2="${y}"/>`).join('')
    + (s.v <= 20 ? '<path d="M15 14l-4 12h5l-2 10 7-14h-5l2-8Z" fill="#fff" opacity=".85"/>' : '')
    + `</svg><b>${s.v}</b><small>${s.имя}</small>${s.слово ? `<em>${escapeHtml(s.слово)}</em>` : ''}${спорШкалы(s)}</div>`;
}
const спорШкалы = (s) => s.спор ? `<em class="hud-bs-odd" title="Мало сна прошлой ночью, а шкала почти полная — не сходится">⚠ ${escapeHtml(s.спор)}</em>` : '';
function колба(s) {
  const id = нид('f'), y = 60 - 40 * s.v / 100;
  const форма = 'M18 6h12v16c9 3 14 11 14 20 0 12-9 20-20 20S4 54 4 42c0-9 5-17 14-20Z';
  return `<div class="hud-bs-cell" style="--c:${s.c}"><svg viewBox="0 0 48 66" aria-hidden="true"><defs><clipPath id="${id}"><path d="${форма}"/></clipPath>`
    + `<linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.c}" stop-opacity=".95"/><stop offset="1" stop-color="${s.c}" stop-opacity=".6"/></linearGradient></defs>`
    + `<g clip-path="url(#${id})"><rect x="0" y="${y.toFixed(1)}" width="48" height="70" fill="url(#${id}g)"/><ellipse cx="24" cy="${y.toFixed(1)}" rx="20" ry="2" fill="#fff" opacity=".35"/>`
    + (s.v > 25 ? `<circle class="bub" cx="16" cy="${(y + 10).toFixed(1)}" r="1.4"/><circle class="bub" cx="28" cy="${(y + 16).toFixed(1)}" r="1"/>` : '') + `</g>`
    + `<path class="glass" d="${форма}"/><rect class="cork" x="16" y="1" width="16" height="6" rx="2"/><path class="shine" d="M10 36c0-5 2-8 6-10"/></svg>`
    + `<b>${s.v}</b><small>${s.имя}</small>${s.слово ? `<em>${escapeHtml(s.слово)}</em>` : ''}${спорШкалы(s)}</div>`;
}
export function видСостоянияТела(value, вид) {
  const д = разобратьСостояниеТела(value);
  if (!д.шкалы.length && !д.сон && !д.дела) return '';
  const бок = (д.сон || д.дела) ? `<div class="hud-bs-side">${д.сон ? `<div class="hud-bs-sleep">${ЛУНА_СНА}<div><b>${escapeHtml(д.сон)}</b><small>сон прошлой ночью</small></div></div>` : ''}${д.дела ? `<div class="hud-bs-work">${escapeHtml(д.дела)}</div>` : ''}</div>` : '';
  const прочее = д.прочее.length ? `<p class="hud-bs-note">${escapeHtml(д.прочее.join('; '))}</p>` : '';
  if (вид === 'chips') {
    return `<div class="hud-bs hud-bs-chips">${д.шкалы.map(s => `<span class="hud-bs-chip" style="--c:${s.c}"><i>${s.v}</i>${s.имя}${s.слово ? `: <b>${escapeHtml(s.слово)}</b>` : ''}${s.спор ? ` <b class="hud-bs-odd">⚠ ${escapeHtml(s.спор)}</b>` : ''}</span>`).join('')}`
      + (д.сон ? `<span class="hud-bs-chip" style="--c:color-mix(in srgb, var(--hud-accent) 55%, #8fa6ff)"><i>☾</i>сон <b>${escapeHtml(д.сон)}</b></span>` : '')
      + (д.дела ? `<span class="hud-bs-chip" style="--c:color-mix(in srgb, var(--hud-accent) 55%, #b8a0e8)"><i>✎</i><b>${escapeHtml(д.дела)}</b></span>` : '') + `</div>${прочее}`;
  }
  const ячейки = д.шкалы.map(вид === 'flasks' ? колба : батарейка).join('');
  return `<div class="hud-bs ${вид === 'flasks' ? 'hud-bs-flasks' : 'hud-bs-bat'}">${ячейки}${бок}</div>${прочее}`;
}

// ---------------------------------------------------------------------------
// ПОВОРОТ СЮЖЕТА (sc.Tw)
// ---------------------------------------------------------------------------
// 'Название: Письмо без обратного адреса; Что случилось: …; Куда ведёт: …; Тон: bad'
const ПИСЬМО = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6.5h17v11h-17Z M3.5 7l8.5 6.5L20.5 7"/></svg>';
const МОЛНИЯ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 3 5 13.5h6L10 21l8-10.5h-6Z"/></svg>';
const ВОПРОС = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/></svg>';
// Компас — к «куда может повести»: это направление, а не пересказ.
const КОМПАС = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8Z"/></svg>';
export function разобратьПоворот(value) {
  const о = { название: '', что: '', куда: '', тон: '' };
  // Кусок без метки продолжает предыдущее поле: модель разделяет «;» и два
  // направления в hnt, и второе раньше уходило в «что случилось».
  let последнее = 'что';
  // Тон модель иногда приклеивает к последнему направлению без «;» —
  // «…или промолчать, ton: neutral» — и метка уходила в текст. Достаём его
  // из любого места строки до разбора.
  let строка = String(value || '');
  const тонГде = строка.match(/[\s,.;—–-]*(?<![\p{L}])(?:ton|tone|тон)\s*[:：]\s*([\p{L}-]+)[\s.]*(?=;|\n|$)/iu);
  if (тонГде) { о.тон = тонГде[1].toLowerCase(); строка = строка.slice(0, тонГде.index) + строка.slice(тонГде.index + тонГде[0].length); }
  строка.split(/;|\n/).map(s => s.trim()).filter(Boolean).forEach(часть => {
    const m = часть.match(/^([^:]{1,20}):\s*(.+)$/);
    const метка = m ? m[1].trim().toLowerCase() : '', тело = m ? m[2].trim() : часть;
    if (/назв|^ttl|title/.test(метка)) { о.название = тело; последнее = 'что'; }
    else if (/случ|^hap|what/.test(метка)) { о.что = тело; последнее = 'что'; }
    else if (/куда|вед|^hnt|hint|lead/.test(метка)) { о.куда = тело; последнее = 'куда'; }
    else if (/тон|^ton|tone/.test(метка)) о.тон = тело.toLowerCase();
    else о[последнее] = о[последнее] ? о[последнее] + '; ' + часть : часть;
  });
  if (!о.название && о.что) { о.название = о.что; о.что = ''; }
  return о;
}
/**
 * «Куда может повести» — по направлениям. Схема просит «1) …; 2) …»; старые
 * повороты писались одной фразой «…, — или …» — их делим по тире перед «или».
 * Простое «или» внутри фразы («в Эдинбург или в Мэн») — не развилка.
 */
export function направленияПоворота(текст) {
  const s = String(текст || '').replace(/\s+/g, ' ').trim();
  if (!s) return [];
  const чистить = (x) => x.replace(/^[\s;,.—–-]+|[\s;,—–-]+$/g, '').trim();
  let части;
  // Номера — только по порядку 1, 2, 3: «в 2024. Потом» не пункт.
  const метки = [];
  for (let n = 1, с = 0; n <= 3; n++) {
    const m = new RegExp(`(?:^|[\\s;,.])${n}[).]\\s`).exec(s.slice(с));
    if (!m) break;
    const где = с + m.index + (m[0].length - 3);
    метки.push(где); с = где + 3;
  }
  if (метки.length >= 2 || (метки.length === 1 && метки[0] === 0)) части = метки.map((от, i) => s.slice(от + 3, метки[i + 1] ?? s.length));
  else части = s.split(/\s*[;,]?\s*[—–]\s*(?=(?:или|or)\s)/i);
  return части.map(чистить).filter(Boolean).slice(0, 3);
}
export function карточкаПоворота(value) {
  if (!есть(value)) return '';
  const п = разобратьПоворот(value);
  if (!п.название) return '';
  const тон = /bad|плох|угроз|опас|тревож/.test(п.тон) ? 'bad' : /good|хорош|удач|свет/.test(п.тон) ? 'good' : 'neutral';
  const знак = тон === 'bad' ? МОЛНИЯ : тон === 'good' ? ПИСЬМО : ВОПРОС;
  // Направления — пунктами, как стрелки компаса; подпись напоминает, что это
  // варианты, а не предсказание.
  const пути = направленияПоворота(п.куда);
  const куда = !пути.length ? '' : `<div class="hud-twist-hint"><div class="hud-twist-hint-head">${КОМПАС}<b>Куда может повести</b><small>варианты, не предсказание</small></div>`
    + (пути.length === 1 ? `<p class="hud-twist-way is-one">${escapeHtml(пути[0])}</p>`
      : `<ol class="hud-twist-ways">${пути.map((w, i) => `<li class="hud-twist-way"><span class="hud-twist-n" aria-hidden="true">${i + 1}</span><span>${escapeHtml(w)}</span></li>`).join('')}</ol>`)
    + `</div>`;
  return `<div class="hud-twist is-${тон}"><span class="hud-twist-rib">ПОВОРОТ</span><h5>${знак}${escapeHtml(п.название)}</h5>`
    + (п.что ? `<p>${escapeHtml(п.что)}</p>` : '') + куда + `</div>`;
}

// ---------------------------------------------------------------------------
// СПУТНИК: карточка и тамагочи
// ---------------------------------------------------------------------------
const И = {
  cond: 'M3 12h4l2-5 4 10 2-5h6', food: 'M5 13h14a7 7 0 0 1-14 0Z M8 9c0-2 2-2 2-4M12 9c0-2 2-2 2-4', note: 'M12 7v5l3 2 M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0',
  bolt: 'M13 3 5 13.5h6L10 21l8-10.5h-6Z', drop: 'M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5Z', smile: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M8 15c1.5-1.5 6.5-1.5 8 0 M9 9.5h.01 M15 9.5h.01',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z', wish: 'M12 3.5l1.9 5.1 5.4.4-4.1 3.5 1.3 5.3L12 15l-4.5 2.8 1.3-5.3-4.1-3.5 5.4-.4Z', candy: 'M8.1 8.1a5.5 5.5 0 0 1 7.8 7.8a5.5 5.5 0 0 1-7.8-7.8Z M8.1 8.1 3 6.4 6.4 3Z M15.9 15.9 21 17.6 17.6 21Z M9.6 14.4c1.8-.4 4.4-3 4.8-4.8', cake: 'M4 21h16 M5.5 21v-7.5h13V21 M5.5 16.5c2.2 1.6 4.4 1.6 6.5 0s4.3-1.6 6.5 0 M12 13.5V10 M12 7.6c-1 0-1.5-1-.8-2.1L12 4l.8 1.5c.7 1.1.2 2.1-.8 2.1Z', shield: 'M12 3.5 5 6v5.5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6Z M9 12l2.2 2.2L15.4 10', plug: 'M9 3v5M15 3v5M7 8h10v4a5 5 0 0 1-10 0Z M12 17v4', gear: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
};
const ик = (k, c = 'currentColor') => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${И[k]}"/></svg>`;
// Вид спутника: цвет, пиксельный спрайт и «механический» ли он.
const СПРАЙТЫ = {
  cat: { цвет: '#e8883a', сп: ['.X.........X..', '.XX.......XX..', '.XXXXXXXXXXX..', 'XXXXXXXXXXXXX.', 'XXGKXXXXXGKXX.', 'XXXXXXPXXXXXX.', '.XXXXWWWXXXXX.', '..XXXXXXXXXX..', '.XXSXXSXXSXXXX', 'XXXXXXXXXXXXXX', 'XX.XX.....XX.X'], пал: { X: '#e8883a', S: '#b8561c', G: '#7be08a', K: '#0a0a0a', P: '#ff9fb4', W: '#fff3e0' } },
  dog: { цвет: '#b07a4a', сп: ['XX........XX..', 'XXX......XXX..', 'XXXXXXXXXXXX..', '.XXXXXXXXXXX..', '.XKXXXXXXKXX..', '.XXXXNNXXXXX..', '..XXWWWWXXX...', '..XXXPPXXX....', '.XXXXXXXXXXXX.', 'XXXXXXXXXXXXXX', 'XX.XX....XX.XX'], пал: { X: '#b07a4a', K: '#1a1a1a', N: '#2a1a12', W: '#f0dcc4', P: '#ff8fa3' } },
  bird: { цвет: '#4a5a8a', сп: ['....XXXX......', '...XXXXXX.....', '..XXKXXXXX....', '..XXXXXXXXOO..', '..XXXXXXXXO...', '.XXXXXXXXX....', 'XXXWWWXXXX....', 'XXWWWWXXXXX...', '.XXXXXXXXXXX..', '...O..O.......'], пал: { X: '#4a5a8a', K: '#f2e8c0', O: '#e8a33a', W: '#8fa0cc' } },
  robot: { цвет: '#6f8fb3', mech: true, сп: ['....XXXXXX....', '..XXXXXXXXXX..', '.XXXLLLLLLXXX.', 'XXXLLEBBELLXXX', 'XXXXLLLLLLXXXX', 'XXXXXXXXXXXXXX', 'XXXXRRRRRRXXXX', '.XXXXXXXXXXXX.', '..XXXXXXXXXX..', '....XXXXXX....'], пал: { X: '#5b6573', L: '#aebcd0', E: '#1a1a1a', B: '#6fd39a', R: '#e0566b' } },
  dragon: { цвет: '#3f9a6a', сп: ['X.........X...', 'XX.......XX...', '.XXXXXXXXXX...', 'XXXXXXXXXXXX..', 'XXYKXXXXYKXX..', 'XXXXXXXXXXXXX.', '.XXWWWWWXXXXXX', '..XXXXXXXXX.XX', '.XXSXXSXXSXX..', 'XX.XX...XX.XX.'], пал: { X: '#3f9a6a', Y: '#f2d14e', K: '#0a0a0a', W: '#c8f0d0', S: '#2a6a48' } },
  spirit: { цвет: '#9a86e0', сп: ['....XXXXX.....', '..XXXXXXXXX...', '.XXXXXXXXXXX..', 'XXXKXXXXKXXXX.', 'XXXXXXXXXXXXX.', 'XXXXXWWWXXXXX.', 'XXXXXXXXXXXXX.', 'XXXXXXXXXXXXX.', 'X.XX.XX.XX.XX.', '...X...X...X..'], пал: { X: '#9a86e0', K: '#1a1030', W: '#e8e0ff' } },
  blob: { цвет: '#e0708f', сп: ['....XXXXX.....', '..XXXXXXXXX...', '.XXXXXXXXXXX..', 'XXXKXXXXKXXXX.', 'XXXXXXXXXXXXX.', 'XXXXPWWWPXXXX.', 'XXXXXXXXXXXXX.', '.XXXXXXXXXXX..', '..XXXXXXXXX...'], пал: { X: '#e0708f', K: '#1a1a1a', W: '#fff', P: '#ffb3c6' } },
};
export function видСпутника(вид, имя) {
  const s = String(вид || '') + ' ' + String(имя || '');
  if (/дрон|робот|андроид|пылесос|машин|drone|robot|android|mech/i.test(s)) return 'robot';
  if (/дракон|виверн|ящер|змей|dragon|wyvern/i.test(s)) return 'dragon';
  if (/ворон|сова|филин|птиц|попуга|сокол|ястреб|raven|crow|owl|bird|parrot/i.test(s)) return 'bird';
  if (/пёс|пес|собак|щен|волк|лис|dog|puppy|hound|wolf|fox/i.test(s)) return 'dog';
  if (/кот|кош|рыс|тигр|лев|пантер|барс|cat|kitten|lynx|tiger|lion/i.test(s)) return 'cat';
  if (/фамильяр|дух|призрак|элементал|familiar|spirit|ghost|wisp/i.test(s)) return 'spirit';
  return 'blob';
}
// Уровни 1-5 из поля lv ('Сытость: 4; Энергия: 3…'); при их отсутствии —
// по словам из состояния и настроения, чтобы тамагочи не был пустым.
const ПОТРЕБНОСТИ = [
  { к: 'food', rx: /сыт|^sat|голод|еда|hunger|food|fed/i, имя: 'Сытость', ик: 'food', c: '#f08a4b' },
  { к: 'energy', rx: /энерг|^eng|сил|energy|stamina/i, имя: 'Энергия', ик: 'bolt', c: '#f2c14e' },
  { к: 'clean', rx: /чист|^cln|clean|hygiene/i, имя: 'Чистота', ик: 'drop', c: '#6fb7ff' },
  { к: 'charge', rx: /заряд|^chg|батар|charge|battery|power/i, имя: 'Заряд', ик: 'plug', c: '#6fd39a' },
  { к: 'fix', rx: /исправ|^fix|поломк|condition|repair|integrity/i, имя: 'Исправность', ик: 'gear', c: '#8fb8ff' },
  { к: 'mood', rx: /настро|^joy|mood/i, имя: 'Настроение', ик: 'smile', c: '#b58cff' },
];
export function потребностиСпутника(p, механизм) {
  const уровни = {};
  String(p.levels || '').split(/;|\n|,/).forEach(часть => {
    const m = часть.match(/^\s*([^:]{1,20}):\s*(\d+(?:[.,]\d+)?)/);
    if (!m) return;
    const н = ПОТРЕБНОСТИ.find(x => x.rx.test(m[1].trim()));
    if (н) { let v = parseFloat(m[2].replace(',', '.')); if (v > 5) v = v / 20; уровни[н.к] = огр(Math.round(v), 0, 5); }
  });
  const слова = (String(p.condition || '') + ' ' + String(p.mood || '') + ' ' + String(p.diet || '')).toLowerCase();
  const угадать = (к) => {
    if (к === 'food') return /голод|не ел|не корм|требует|hungry|starving|unfed|not fed|begging/.test(слова) ? 1 : /сыт|покорм|поел|\bfed\b|full|ate\b/.test(слова) ? 4 : 3;
    if (к === 'energy') return /устал|спит|вял|измот|tired|sleep|lethargic|sluggish|exhausted/.test(слова) ? 2 : /бодр|носится|игрив|энерг|energetic|zoom|playful|bouncy|lively/.test(слова) ? 5 : 3;
    if (к === 'clean') return /гряз|мокр|в грязи|dirty|muddy|\bwet\b|filthy/.test(слова) ? 2 : /вылиз|чист|clean|groomed|washed/.test(слова) ? 5 : 4;
    if (к === 'charge') { const m = слова.match(/(\d{1,3})\s*%/); return m ? огр(Math.round(+m[1] / 20), 0, 5) : /разряж|сел|dead|drained|low battery|discharged|flat\b/.test(слова) ? 1 : 3; }
    if (к === 'fix') return /слом|поврежд|сбой|застрял|broken|damaged|glitch|malfunction|stuck|error/.test(слова) ? 2 : 4;
    if (к === 'mood') return /обиж|зл|рыч|груст|скуч|испуг|sulk|angry|growl|hiss|sad|bored|scared|afraid|grumpy/.test(слова) ? 1 : /рад|доволь|мурч|счаст|игрив|happy|content|purr|joy|playful|wagging/.test(слова) ? 5 : 3;
    return 3;
  };
  const набор = механизм ? ['charge', 'fix', 'mood'] : ['food', 'energy', 'clean', 'mood'];
  return набор.map(к => ({ ...ПОТРЕБНОСТИ.find(x => x.к === к), n: уровни[к] ?? угадать(к) }));
}
const инициалы = (имя) => инициалыИмени(имя || '?');
// Хозяин бывает фразой: «на попечении Мари Беннет в комнате 307» давало
// кружок «НЗ», «прибрежная стая старого причала» — «ПП». Инициалы — только
// от имени: всё поле, если это имя, иначе имя внутри фразы; нет имени — лапка.
// Кружок хозяина: фото (ручная аватарка, персона, карточка), иначе инициалы.
// data-ava-* — чтобы refreshAvatarFaces менял картинку без перерисовки.
function лицоХозяина(имя) {
  if (!имя) return '<i>🐾</i>';
  const url = аватаркаПоИмени(имя);
  return `<i class="${url ? 'has-img' : ''}" data-ava-name="${escapeHtml(имя)}" data-ava-auto="1" data-ava-bg=""${url ? ` style="background-image:url('${escapeHtml(url)}')"` : ''}>${escapeHtml(инициалы(имя))}</i>`;
}
function имяХозяина(s) {
  const t = String(s || '').trim();
  if (/^(?:\p{Lu}[\p{L}'’.-]*\s*){1,3}$/u.test(t)) return t;
  for (const m of t.matchAll(/\p{Lu}[\p{L}'’-]+(?:\s+\p{Lu}[\p{L}'’-]+)?/gu)) if (m.index > 0 || /\s/.test(m[0])) return m[0];
  return '';
}
// Род для портрета — подробнее, чем для тамагочи (видСпутника): лиса, медведь,
// лошадь, кролик, грызун, сова, летучая мышь, змея — у каждого свой рисунок.
export function родПортрета(вид, имя) {
  const s = String(вид || '') + ' ' + String(имя || '');
  if (/дрон|робот|андроид|пылесос|машин|голем|drone|robot|android|mech|golem/i.test(s)) return 'robot';
  if (/дракон|виверн|ящер|dragon|wyvern|drake/i.test(s)) return 'dragon';
  if (/зме|гадюк|удав|питон|кобр|полоз|snake|serpent|viper|python|cobra/i.test(s)) return 'snake';
  if (/сова|сов[уыё]|филин|сыч|неясыт|owl/i.test(s)) return 'owl';
  if (/летуч\p{L}*\s+мыш|нетопыр|вампир\p{L}*\s+мыш|\bbat\b/iu.test(s)) return 'bat';
  if (/ворон|птиц|попуга|сокол|ястреб|голуб[ьяи]|воробе|сорок|канарей|феникс|raven|crow|bird|parrot|falcon|hawk|dove|phoenix|magpie/i.test(s)) return 'bird';
  // «Лис» — с начала слова, чтобы Алиса не стала лисой.
  if (/(?:^|[^\p{L}])(?:лис|песц|песец|фенек|корсак)|fox|fennec/iu.test(s)) return 'fox';
  if (/(?:^|[^\p{L}])(?:рыс[ьи]|рысью|рыс[её]нок|lynx(?:es)?)(?!\p{L})/iu.test(вид || '')) return 'lynx';
  if (/(?:^|[^\p{L}])(?:волк[а-яё]*|волчон[а-яё]*|wol(?:f|ves))(?!\p{L})/iu.test(вид || '')) return 'wolf';
  if (/(?:^|[^\p{L}])(?:лев|льв[а-яё]+|lion(?:ess(?:es)?|s)?)(?!\p{L})/iu.test(вид || '')) return 'lion';
  if (/далматин|овчар|терьер|спаниел|такс[аы]|хаски|лабрадор|ретривер|бульдог|пудел|шпиц|корги|мастиф|борз[аы]|гончая|ротвейлер|доберман|сенбернар|dalmatian|shepherd|terrier|spaniel|dachshund|husky|labrador|retriever|bulldog|poodle|corgi|mastiff/i.test(s)) return 'dog';
  if (/медвед|медвеж|bear|панд[аы]|panda/i.test(s)) return 'bear';
  if (/конь|лошад|пони|кобыл|жереб|единорог|пегас|horse|pony|mare|stallion|unicorn|pegasus/i.test(s)) return 'horse';
  if (/кролик|зая[цч]|зайч|крольч|rabbit|bunny|hare/i.test(s)) return 'rabbit';
  if (/крыс|мыш|хомяк|хор[её]к|ласк|бел(?:к|очк)|шиншил|дегу|rat\b|mouse|hamster|ferret|weasel|squirrel|chinchilla/i.test(s)) return 'rodent';
  if (/кот|кош|рыс|тигр|льв|лев|пантер|барс|леопард|ягуар|гепард|оцелот|каракал|сервал|\bcat|kitten|lynx|tiger|lion|panther|leopard|jaguar|cheetah/i.test(s)) return 'cat';
  if (/п[её]с|собак|щен|волк|dog|pupp|hound|wolf/i.test(s)) return 'dog';
  return видСпутника(вид, имя);
}
// Мех и светлое по умолчанию, когда цвет не назван и не запомнен.
const ОКРАС_РОДА = {
  cat: ['#c08240', '#e6b47a'], dog: ['#a8784a', '#d8b48a'], fox: ['#d9822b', '#f6efe6'], bear: ['#6e4a2e', '#a07650'],
  lion: ['#dfa34d', '#f7d9a0'], wolf: ['#808999', '#ced6df'], lynx: ['#b58868', '#ead8c5'],
  horse: ['#7a5232', '#a8784f'], rabbit: ['#b8a894', '#ece4d8'], rodent: ['#8f8a86', '#d6d0ca'], bird: ['#4a5a8a', '#8fa0c8'],
  owl: ['#8a6a48', '#d8c4a4'], bat: ['#4a4048', '#7a6e76'], snake: ['#4a8a4a', '#a8d090'], robot: ['#8fa6c0', '#d4dee9'],
  dragon: ['#3f9a6a', '#8fd0a6'], spirit: ['#9a86e0', '#d6ccff'], blob: ['#e0708f', '#f6b4c6'],
};
// Узор по умолчанию у пород, где он часть вида: тигр полосатый, барс пятнистый.
const УЗОР_ВИДА = [[/тигр|tiger|зебр|zebra/i, 'stripes'], [/леопард|барс|ягуар|гепард|оцелот|рыс[ьи]|далматин|leopard|jaguar|cheetah|ocelot|lynx|dalmatian/i, 'spots']];

// Портрет 48×48 по роду: шерсть — var(--fur), светлое — var(--fur2), цвет темы — var(--p),
// глаза — var(--eye) и var(--eye2) (правый: гетерохромия). Глаза моргают,
// сам портрет чуть дышит (css/extras.css, .hud-pet2-ava).
// Глаз — миндалина с наклоном: радужка цветом глаз, зрачок по виду (щель у
// кошки, лисы, рептилий; круглый у остальных), два блика и линия века.
// Оба глаза — в одной группе .eyes: они моргают вместе.
const ф2 = (n) => Math.round(n * 100) / 100;
function глаз(x, y, { w = 3, h = 2.4, наклон = .5, зрачок = 'round', правый = false, класс = '' } = {}) {
  const к = правый ? 1 : -1;                        // в какую сторону внешний угол
  const внеш = [ф2(x + к * w), ф2(y - наклон)], внутр = [ф2(x - к * w), ф2(y + наклон * .4)];
  const форма = `M${внеш} Q${ф2(x)} ${ф2(y - h * 1.32)} ${внутр} Q${ф2(x)} ${ф2(y + h * 1.12)} ${внеш}Z`;
  const з = зрачок === 'slit' ? `<ellipse class="pupil" cx="${ф2(x)}" cy="${ф2(y)}" rx="${ф2(w * .2)}" ry="${ф2(h * .9)}"/>`
    : `<circle class="pupil" cx="${ф2(x)}" cy="${ф2(y + h * .05)}" r="${ф2(h * (зрачок === 'big' ? .5 : .42))}"/>`;
  return `<path class="eye${правый ? ' r' : ''}${класс}" d="${форма}"/>${з}`
    + `<circle class="glint" cx="${ф2(x - к * w * .28)}" cy="${ф2(y - h * .36)}" r="${ф2(h * .26)}"/><circle class="glint2" cx="${ф2(x + к * w * .3)}" cy="${ф2(y + h * .32)}" r="${ф2(h * .13)}"/>`
    + `<path class="lid" d="M${внеш} Q${ф2(x)} ${ф2(y - h * 1.32)} ${внутр}"/>`;
}
const ГЛАЗА = (x1, x2, y, о = {}) => `<g class="eyes">${глаз(x1, y, о)}${глаз(x2, y, { ...о, правый: true })}</g>`;
const ЩЁКИ = (x1, x2, y) => `<ellipse class="cheek" cx="${x1}" cy="${y}" rx="2.7" ry="1.45"/><ellipse class="cheek" cx="${x2}" cy="${y}" rx="2.7" ry="1.45"/>`;
const ОШЕЙНИК = '<path class="collar" d="M13.4 40.6c6 3.2 15.2 3.2 21.2 0l.9 3c-6.6 3.6-16.4 3.6-23 0Z"/><circle class="tag" cx="24" cy="45.6" r="2.4"/><circle class="tag-hi" cx="23.3" cy="44.9" r=".7"/>';
// Узоры поверх меха: на лбу и щеках, у лошади — по морде.
const УЗОР = {
  stripes: '<path class="mark" d="M20.6 13.8 22 18.2M24 12.8V17.8M27.4 13.8 26 18.2M9.4 24.8l4.6 1.2M9.6 28.4l4.4-.2M38.6 24.8l-4.6 1.2M38.4 28.4l-4.4-.2"/>',
  spots: '<g class="mark-f"><circle cx="16.4" cy="17.6" r="1.4"/><circle cx="31.2" cy="16.8" r="1.2"/><circle cx="12.6" cy="27.6" r="1.1"/><circle cx="35.4" cy="27.2" r="1.3"/><circle cx="27.4" cy="13.2" r=".9"/><circle cx="20.4" cy="13.2" r="1"/><circle cx="11" cy="22.6" r=".8"/><circle cx="37" cy="22.2" r=".8"/></g>',
  patches: '<path class="patch a" d="M11 20c.6-5 3.4-8.4 7.6-9.4 1.6 3.2 1.4 7.6-1.4 10.4-1.8 1.8-4.4 1.8-6.2-1Z"/><path class="patch b" d="M37.4 26c-.2 3.8-2.2 6.6-5.6 7.4-1.6-2.8-.8-6.4 2-8 1.4-.8 2.8-.6 3.6.6Z"/>',
};
// Мягкий объём: тень на щеках и челюсти, блик на лбу — общие для меха.
const тень = (d) => `<path class="shade" d="${d}"/>`, блик = (cx, cy, rx, ry) => `<ellipse class="light" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`;
const УСЫ = (y, разлёт = 9) => `<path class="whisk" d="M17.6 ${y}C14 ${y - 1.4} 11.4 ${y - 1.6} ${17.6 - разлёт} ${y - 1}M17.6 ${y + 1.4}C14 ${y + 1.6} 11.4 ${y + 2.4} ${17.6 - разлёт + .6} ${y + 3.2}M30.4 ${y}C34 ${y - 1.4} 36.6 ${y - 1.6} ${30.4 + разлёт} ${y - 1}M30.4 ${y + 1.4}C34 ${y + 1.6} 36.6 ${y + 2.4} ${30.4 + разлёт - .6} ${y + 3.2}"/>`
  + `<g class="pore"><circle cx="19.4" cy="${y + .2}" r=".35"/><circle cx="20.4" cy="${y + 1.4}" r=".35"/><circle cx="28.6" cy="${y + .2}" r=".35"/><circle cx="27.6" cy="${y + 1.4}" r=".35"/></g>`;

function портретСпутника(род, вид, узор) {
  const s = String(вид || '');
  const рысь = /рыс|lynx|каракал|caracal/i.test(s), рог = /единорог|unicorn/i.test(s), крылья = /пегас|pegasus|крылат/i.test(s);
  const П = {
    // Кошка: голова с ушами и пушистыми щеками — один контур.
    cat: '<path class="fur" d="M17 11.5C14 9 11 6.5 9 5.5c-.4 4 .2 8 1.6 11.3C8.4 20 7.6 23.6 8 27c-1.4 1.4-2 3-1.6 4.4 1.2-.2 2.2.2 3 1C11 37.6 16.6 41.4 24 41.4s13-3.8 14.6-9c.8-.8 1.8-1.2 3-1 .4-1.4-.2-3-1.6-4.4.4-3.4-.4-7-2.6-10.2C38.8 13.5 39.4 9.5 39 5.5c-2 1-5 3.5-8 6-2.2-.9-4.6-1.3-7-1.3s-4.8.4-7 1.3Z"/>'
      + '<path class="inner" d="M11 8.6c.4 3 1.2 5.4 2.6 7 1.2-1.8 2.4-3 3.6-3.6-2-1.4-4.2-2.6-6.2-3.4Z M37 8.6c-.4 3-1.2 5.4-2.6 7-1.2-1.8-2.4-3-3.6-3.6 2-1.4 4.2-2.6 6.2-3.4Z"/>'
      + (рысь ? '<path class="tuft" d="M9 5.6 8 1.2M39 5.6l1-4.4"/>' : '')
      + блик(24, 17.4, 8.6, 4.6) + '@УЗОР@' + тень('M9.4 32.4C11 37.6 16.6 41.4 24 41.4s13-3.8 14.6-9c-5.6 4-23.6 4-29.2 0Z')
      + '<path class="fur2" d="M24 29.4c-2.6-1.8-7.4-1.4-8.4 1.6-.8 2.8 1.8 4.8 4.8 4.6 1.6-.1 2.8-.8 3.6-1.8.8 1 2 1.7 3.6 1.8 3 .2 5.6-1.8 4.8-4.6-1-3-5.8-3.4-8.4-1.6Z M21.4 36c1 1.6 4.2 1.6 5.2 0-1-.6-4.2-.6-5.2 0Z"/>'
      + ГЛАЗА(18.2, 29.8, 24.4, { w: 3.7, h: 3.7, наклон: .12, зрачок: 'big' }) + ЩЁКИ(13.4, 34.6, 30.2)
      + '<path class="nose" d="M22.2 29.2c0-.8 3.6-.8 3.6 0s-1.2 1.7-1.8 2c-.6-.3-1.8-1.2-1.8-2Z"/><ellipse class="nose-hi" cx="23.4" cy="29.2" rx=".7" ry=".35"/>'
      + '<path class="line" d="M24 31.2v1M24 32.2c-.8 1.2-2.4 1.4-3.2.6M24 32.2c.8 1.2 2.4 1.4 3.2.6"/>' + УСЫ(31.4, 10),
    // Собака: висячие уши за головой, светлая морда и «проточина» на лбу.
    dog: '<path class="ear" d="M14 12.5c-4.5-.5-7.2 3.5-7.4 8.5-.2 5 1 9.4 3.4 10.6 2 1 3.6-.8 4.2-3.6L15.6 18Z M34 12.5c4.5-.5 7.2 3.5 7.4 8.5.2 5-1 9.4-3.4 10.6-2 1-3.6-.8-4.2-3.6L32.4 18Z"/>'
      + '<path class="fur" d="M24 10c-7 0-11.4 4.6-11.4 11.4 0 2.6.4 5 1.2 7.2.8 7 4.8 12 10.2 12s9.4-5 10.2-12c.8-2.2 1.2-4.6 1.2-7.2C35.4 14.6 31 10 24 10Z"/>'
      + блик(24, 15.6, 7.4, 3.8) + '@УЗОР@' + тень('M13.8 28.6c.8 7 4.8 12 10.2 12s9.4-5 10.2-12c-3 4.6-17.4 4.6-20.4 0Z')
      + '<path class="fur2 soft" d="M24 14c-1 4-1.2 8-.8 12h1.6c.4-4 .2-8-.8-12Z"/><path class="fur2" d="M24 25.6c-4.6 0-7.2 2.8-7.2 6.2 0 4 3 6.8 7.2 6.8s7.2-2.8 7.2-6.8c0-3.4-2.6-6.2-7.2-6.2Z"/>'
      + ГЛАЗА(18.6, 29.4, 22.4, { w: 3.4, h: 3.5, наклон: 0, зрачок: 'big' }) + ЩЁКИ(13.8, 34.2, 28.6)
      + '<path class="nose" d="M21 28.6c0-1.6 6-1.6 6 0 0 1.8-1.6 3-3 3s-3-1.2-3-3Z"/><ellipse class="nose-hi" cx="22.8" cy="28.3" rx="1" ry=".45"/>'
      + '<path class="line" d="M24 31.6v1.6M24 33.2c-1.2 1.6-3.4 1.6-4.4.4M24 33.2c1.2 1.6 3.4 1.6 4.4.4"/>'
      + '<path class="tongue" d="M22.4 34.4c0 2.6.6 3.6 1.6 3.6s1.6-1 1.6-3.6c-.6.4-2.6.4-3.2 0Z"/><path class="tongue-line" d="M24 34.8v2.2"/>',
    // Лиса: большие уши с тёмными кончиками, рыжий лоб клином к носу, белые щёки.
    fox: '<path class="fur" d="M17.6 12.2C15 9.2 11.4 5.6 7.8 3.6c-1 4.6-.6 9.6 1.4 13.8C7.6 20.4 7 23.6 7.4 26.8c-1.2 1.4-2 3-2 4.4 1.6-.2 3 .2 4 .8C11.6 37.4 17.2 41 24 41s12.4-3.6 14.6-9c1-.6 2.4-1 4-.8 0-1.4-.8-3-2-4.4.4-3.2-.2-6.4-1.8-9.4 2-4.2 2.4-9.2 1.4-13.8C36.6 5.6 33 9.2 30.4 12.2c-2-.7-4.2-1-6.4-1s-4.4.3-6.4 1Z"/>'
      + '<path class="tip" d="M7.8 3.6C7.2 6 7.1 8 7.4 10.2 8.6 9 10 8 11.6 7.2 10.4 5.8 9.2 4.6 7.8 3.6Z M40.2 3.6C40.8 6 40.9 8 40.6 10.2 39.4 9 38 8 36.4 7.2 37.6 5.8 38.8 4.6 40.2 3.6Z"/>'
      + '<path class="inner" d="M10 9c.2 3 .9 5.6 2.2 7.4 1.4-1.6 3-2.8 4.6-3.6C14.6 11 12.4 9.8 10 9Z M38 9c-.2 3-.9 5.6-2.2 7.4-1.4-1.6-3-2.8-4.6-3.6C33.4 11 35.6 9.8 38 9Z"/>'
      + блик(24, 17, 8, 4) + '@УЗОР@'
      + тень('M9.4 32c2.2 5.4 7.8 9 14.6 9s12.4-3.6 14.6-9c-4.4 4.6-24.8 4.6-29.2 0Z')
      + '<path class="fur2" d="M5.4 31.2c1.6-.2 3 .2 4 .8C11.6 37.4 17.2 41 24 41s12.4-3.6 14.6-9c1-.6 2.4-1 4-.8-2.6-2.6-6.2-4.2-10-3.6-3.4.6-5.6 3.6-8.6 3.6s-5.2-3-8.6-3.6c-3.8-.6-7.4 1-10 3.6Z"/>'
      + ГЛАЗА(17.6, 30.4, 24, { w: 3.5, h: 3.6, наклон: .1, зрачок: 'big' }) + ЩЁКИ(12.8, 35.2, 29.5)
      + '<path class="nose" d="M22.2 31.6c0-1 3.6-1 3.6 0 0 1.1-1.1 2-1.8 2.2-.7-.2-1.8-1.1-1.8-2.2Z"/><ellipse class="nose-hi" cx="23.4" cy="31.4" rx=".7" ry=".35"/>'
      + '<path class="line" d="M24 33.8v.8M24 34.6c-.8 1-2.2 1.2-3 .4M24 34.6c.8 1 2.2 1.2 3 .4"/>' + УСЫ(33.6, 8),
    lion: (/львиц|lioness/i.test(s) ? '' : '<path class="mane" d="M24 4c3.6-2 7.7-.8 9.5 2.5 4.3-.9 8 2 8 6.2 4.1 1.4 5.4 5.8 3.1 9.2 3.1 3.7 1.7 8.2-2 10.5.3 4.8-3 8-7.2 8-1.8 3.7-6.4 4.7-11.4 2.6-5 2.1-9.6 1.1-11.4-2.6-4.2 0-7.5-3.2-7.2-8-3.7-2.3-5.1-6.8-2-10.5-2.3-3.4-1-7.8 3.1-9.2 0-4.2 3.7-7.1 8-6.2C16.3 3.2 20.4 2 24 4Z"/>')
      + '<circle class="fur" cx="12.4" cy="13.4" r="5.5"/><circle class="fur" cx="35.6" cy="13.4" r="5.5"/><circle class="inner" cx="12.4" cy="13.4" r="3.3"/><circle class="inner" cx="35.6" cy="13.4" r="3.3"/>'
      + '<path class="fur" d="M24 9.2c-9 0-15.6 7.4-15.6 16.2 0 8.6 6.9 14.3 15.6 14.3s15.6-5.7 15.6-14.3C39.6 16.6 33 9.2 24 9.2Z"/>'
      + блик(22, 15.4, 7, 3) + '@УЗОР@'
      + '<ellipse class="fur2" cx="24" cy="32.3" rx="10.2" ry="5.7"/>'
      + ГЛАЗА(17.7, 30.3, 23.7, { w: 3.6, h: 3.7, наклон: 0, зрачок: 'big' }) + ЩЁКИ(13.8, 34.2, 29.3)
      + '<path class="nose" d="M21 29.6q3-1.8 6 0-1 2.8-3 3-2-.2-3-3Z"/><path class="line" d="M24 32.7v1.1m0 0q-1.7 2-3.8.6m3.8-.6q1.7 2 3.8.6"/>' + УСЫ(33, 6),
    wolf: '<path class="fur" d="M17 12.1C13.7 8.9 10.8 6.3 6.7 4.8c-.5 5.4.6 10.5 2.8 14.3-1.8 2.9-2.4 6-2 8.8l-2.8 4.5 4.5-.4-1.2 3.5 5.1-.9c2.6 4.6 6.9 7.3 10.9 7.3s8.3-2.7 10.9-7.3l5.1.9-1.2-3.5 4.5.4-2.8-4.5c.4-2.8-.2-5.9-2-8.8 2.2-3.8 3.3-8.9 2.8-14.3-4.1 1.5-7 4.1-10.3 7.3-4.5-1.8-9.5-1.8-14 0Z"/>'
      + '<path class="inner" d="M9.1 8.7q.4 5 2.8 8.2l3.4-3.4q-2.6-3-6.2-4.8Zm29.8 0q-.4 5-2.8 8.2l-3.4-3.4q2.6-3 6.2-4.8Z"/>'
      + блик(24, 16.1, 7, 3) + '@УЗОР@'
      + '<path class="fur2" d="M9.4 29.7c6.1-3 10.2-1.5 14.6 2.7 4.4-4.2 8.5-5.7 14.6-2.7-2.4 6.4-8 11-14.6 11s-12.2-4.6-14.6-11Z"/>'
      + ГЛАЗА(17.1, 30.9, 24.2, { w: 3.5, h: 3.7, наклон: .1, зрачок: 'big' }) + ЩЁКИ(13.8, 34.2, 30.1)
      + '<path class="nose" d="M20.8 31.1q3.2-2 6.4 0-.4 2.3-3.2 3.5-2.8-1.2-3.2-3.5Z"/><ellipse class="nose-hi" cx="23" cy="31" rx=".9" ry=".45"/><path class="line" d="M24 34.7v1.1m0 0q-1.8 2.1-3.9.7m3.9-.7q1.8 2.1 3.9.7"/>',
    lynx: '<path class="fur" d="M16.5 12.5 8 6.2c-.9 4.7-.6 9.6 1 13.5-1.4 2.8-2.1 5.3-2 8l-3.1 4.6 4.6-.3-1.6 4.1 5.4-.5c3 3.6 7.3 5.5 11.7 5.5s8.7-1.9 11.7-5.5l5.4.5-1.6-4.1 4.6.3-3.1-4.6c.1-2.7-.6-5.2-2-8 1.6-3.9 1.9-8.8 1-13.5l-8.5 6.3c-4.6-1.8-10.4-1.8-15 0Z"/>'
      + '<path class="tip" d="M8 9.4 6.4 1.8 12 9.3l1.5 1.5ZM40 9.4l1.6-7.6L36 9.3l-1.5 1.5Z"/><path class="inner" d="M10.7 10.4c-.3 2.8.1 5.6.9 7.3l4.1-4Zm26.6 0c.3 2.8-.1 5.6-.9 7.3l-4.1-4Z"/>'
      + блик(24, 16.1, 6.5, 2.7) + '@УЗОР@'
      + '<path class="fur2" d="M11.4 32.8q5.8-6.5 12.6-1.3 6.8-5.2 12.6 1.3c-2.8 4.9-7.2 6.9-12.6 6.9s-9.8-2-12.6-6.9Z"/>'
      + ГЛАЗА(17.3, 30.7, 24.1, { w: 3.7, h: 3.8, наклон: .2, зрачок: 'big' }) + ЩЁКИ(13.6, 34.4, 30.7)
      + '<path class="nose" d="M21.4 31.1q2.6-1.6 5.2 0-.5 2.2-2.6 2.9-2.1-.7-2.6-2.9Z"/><path class="line" d="M24 34v1m0 0q-1.4 1.8-3.2.7m3.2-.7q1.4 1.8 3.2.7"/>' + УСЫ(34, 8),
    // Медведь: круглые уши в общем контуре, широкая светлая морда.
    bear: '<path class="fur" d="M13.5 8.4C10 8.4 7.6 11 7.6 14c0 2.2 1.2 4 3 4.8-1.2 2-1.8 4.2-1.8 6.6 0 9 6.8 15.4 15.2 15.4s15.2-6.4 15.2-15.4c0-2.4-.6-4.6-1.8-6.6 1.8-.8 3-2.6 3-4.8 0-3-2.4-5.6-5.9-5.6-2.5 0-4.5 1.4-5.3 3.4-1.6-.5-3.4-.8-5.2-.8s-3.6.3-5.2.8c-.8-2-2.8-3.4-5.3-3.4Z"/>'
      + '<path class="inner" d="M13.4 11c-1.8 0-3.2 1.4-3.2 3.2 0 1.2.6 2.2 1.6 2.8 1.2-1.4 2.6-2.6 4.2-3.4-.4-1.6-1.4-2.6-2.6-2.6Z M34.6 11c1.8 0 3.2 1.4 3.2 3.2 0 1.2-.6 2.2-1.6 2.8-1.2-1.4-2.6-2.6-4.2-3.4.4-1.6 1.4-2.6 2.6-2.6Z"/>'
      + блик(24, 17.6, 9, 4.6) + '@УЗОР@' + тень('M9.4 29.4c1.6 6.6 7.6 11.4 14.6 11.4s13-4.8 14.6-11.4c-4.4 5.4-24.8 5.4-29.2 0Z')
      + '<path class="fur2" d="M24 25.2c-4.4 0-7.6 2.4-7.6 5.8 0 3.8 3.4 6.8 7.6 6.8s7.6-3 7.6-6.8c0-3.4-3.2-5.8-7.6-5.8Z"/>'
      + ГЛАЗА(17.4, 30.6, 23.4, { w: 3.2, h: 3.4, наклон: 0, зрачок: 'big' }) + ЩЁКИ(12.9, 35.1, 29.8)
      + '<path class="nose" d="M20.6 28.8c0-1.8 6.8-1.8 6.8 0s-1.8 3-3.4 3-3.4-1.2-3.4-3Z"/><ellipse class="nose-hi" cx="22.8" cy="28.4" rx="1.1" ry=".5"/>'
      + '<path class="line" d="M24 31.8v1.6M24 33.4c-1 1.2-2.6 1.2-3.4.4M24 33.4c1 1.2 2.6 1.2 3.4.4"/>',
    // Лошадь: длинная голова анфас, глаза по бокам, чёлка, широкая морда.
    horse: (крылья ? '<path class="wing2" d="M15.4 24C8.4 20.6 3.6 14.6 3.4 7.6c2.4 3.6 5.4 5.4 8.4 6.2-1.6 1.6-1.8 3.4-1 5 1.8-1 3.6-1 5 .2Z M32.6 24c7-3.4 11.8-9.4 12-16.4-2.4 3.6-5.4 5.4-8.4 6.2 1.6 1.6 1.8 3.4 1 5-1.8-1-3.6-1-5 .2Z"/>' : '')
      + '<path class="fur" d="M17.6 12c-1.2-3-2-6-1.8-8.4 2 1.4 3.6 3.4 4.8 5.8 1.2-.3 2.3-.4 3.4-.4s2.2.1 3.4.4c1.2-2.4 2.8-4.4 4.8-5.8.2 2.4-.6 5.4-1.8 8.4 2.2 1.6 3.2 4 3 7-.2 4-1.4 8-1.8 12-.2 2 .8 4 .8 6 0 4-3.8 7-8.4 7s-8.4-3-8.4-7c0-2 1-4 .8-6-.4-4-1.6-8-1.8-12-.2-3 .8-5.4 3-7Z"/>'
      + '<path class="inner" d="M17.2 6c.2 1.8.8 3.6 1.8 5l1.2-1c-.8-1.6-1.8-3-3-4Z M30.8 6c-.2 1.8-.8 3.6-1.8 5l-1.2-1c.8-1.6 1.8-3 3-4Z"/>'
      + (рог ? '<path class="horn" d="M24 .4 22.2 9.4h3.6Z"/><path class="horn-line" d="M22.8 7.4 25.2 6.6M23.2 5 25 4.4M23.6 2.8l1-.4"/>' : '')
      + блик(24, 18, 5.6, 5) + '@УЗОР@' + '<path class="fur2 soft" d="M24 13c-1.2 4-1.6 9-1.2 14 .2 2 .6 4 1.2 6 .6-2 1-4 1.2-6 .4-5 0-10-1.2-14Z"/>'
      + '<path class="mane" d="M24 8.6c-3.4.4-5.6 2.4-6 5.2 1.6-1 3.2-1.2 4.4-.6-.8 1.6-1 3.4-.6 5 1-2.6 2.8-4.2 5.2-4.6.8-.6 1.6-.8 2.4-.6-1-2.6-3-4.4-5.4-4.4Z"/>'
      + '<path class="muzzle" d="M15.8 36.4c0-3.8 3.6-5.4 8.2-5.4s8.2 1.6 8.2 5.4c0 4.4-3.6 7.2-8.2 7.2s-8.2-2.8-8.2-7.2Z"/>' + тень('M15.8 37c.4 4 3.8 6.6 8.2 6.6s7.8-2.6 8.2-6.6c-3 3-13.4 3-16.4 0Z')
      + ГЛАЗА(16.6, 31.4, 20.6, { w: 3.4, h: 3.6, наклон: -.12, зрачок: 'big' }) + ЩЁКИ(15.5, 32.5, 26.7)
      + '<path class="nostril" d="M19.6 38.6c1-1.2 2.4-1 2.6.4M28.4 38.6c-1-1.2-2.4-1-2.6.4"/><path class="line" d="M21.4 41.6c1.6.8 3.6.8 5.2 0"/>',
    // Кролик: длинные уши растут из головы, пухлые щёки, резцы.
    rabbit: '<path class="fur" d="M18.6 19c-2.2-6-3-12.6-1.2-15.6 2.2.2 3.6 5.6 3.6 12 0 1-.1 2-.2 2.9 1-.2 2.1-.3 3.2-.3s2.2.1 3.2.3c-.1-.9-.2-1.9-.2-2.9 0-6.4 1.4-11.8 3.6-12 1.8 3 1 9.6-1.2 15.6 4.2 2 7.2 6 7.2 11 0 6.6-5.6 11.4-12.6 11.4S11.4 36.6 11.4 30c0-5 3-9 7.2-11Z"/>'
      + '<path class="inner" d="M18.4 16.6c-1-4.6-1.2-9.2-.4-11 1 1.8 1.4 6 1.4 10.8Z M29.6 16.6c1-4.6 1.2-9.2.4-11-1 1.8-1.4 6-1.4 10.8Z"/>'
      + блик(24, 23.6, 7.6, 3.6) + '@УЗОР@' + тень('M11.6 31.6c1 5.6 6.2 9.8 12.4 9.8s11.4-4.2 12.4-9.8c-4 4.4-20.8 4.4-24.8 0Z')
      + '<path class="fur2" d="M24 30.4c-3-1.6-6.6-.8-7 2-.4 3 2.6 5 5.6 4.2.6-.2 1.1-.5 1.4-.8.3.3.8.6 1.4.8 3 .8 6-1.2 5.6-4.2-.4-2.8-4-3.6-7-2Z"/>'
      + ГЛАЗА(17.2, 30.8, 27, { w: 3.5, h: 3.6, наклон: 0, зрачок: 'big' }) + ЩЁКИ(15, 33, 32.6)
      + '<path class="nose" d="M22.6 31.2c0-.6 2.8-.6 2.8 0 0 .7-.9 1.4-1.4 1.6-.5-.2-1.4-.9-1.4-1.6Z"/>'
      + '<path class="tooth" d="M23 34.4h2v2c0 .4-.3.6-.5.6h-1c-.3 0-.5-.2-.5-.6Z"/><path class="line" d="M24 32.8v1.6M24 34.4v2.6"/>' + УСЫ(33, 8),
    // Грызун: большие круглые уши, острая морда, бусины глаз.
    rodent: '<path class="fur" d="M13 7.6c-4.4 0-7.4 3.4-7.4 7.2 0 3.4 2.4 6 5.6 6.6-.6 1.4-.8 2.8-.8 4.2 0 5.8 5 11 10.6 14.4 1 .6 2 1 3 1s2-.4 3-1c5.6-3.4 10.6-8.6 10.6-14.4 0-1.4-.2-2.8-.8-4.2 3.2-.6 5.6-3.2 5.6-6.6 0-3.8-3-7.2-7.4-7.2-3.4 0-6 2.2-6.8 5-1.4-.4-2.8-.6-4.2-.6s-2.8.2-4.2.6c-.8-2.8-3.4-5-6.8-5Z"/>'
      + '<path class="inner" d="M13 10c-2.8 0-4.8 2.2-4.8 4.8 0 2.2 1.4 4 3.4 4.4 1.8-2.2 4-4 6.4-5.2-.4-2.2-2.4-4-5-4Z M35 10c2.8 0 4.8 2.2 4.8 4.8 0 2.2-1.4 4-3.4 4.4-1.8-2.2-4-4-6.4-5.2.4-2.2 2.4-4 5-4Z"/>'
      + блик(24, 19.6, 7.4, 3.6) + '@УЗОР@' + тень('M11.6 29.6c2 4.4 6.2 8 9.4 10.4 1 .6 2 1 3 1s2-.4 3-1c3.2-2.4 7.4-6 9.4-10.4-5 4.4-19.8 4.4-24.8 0Z')
      + '<path class="fur2" d="M24 26.6c-4 0-7.4 2.4-7.4 5.4 1.4 3 4.2 5.8 7.4 7.8 3.2-2 6-4.8 7.4-7.8 0-3-3.4-5.4-7.4-5.4Z"/>'
      + ГЛАЗА(18.4, 29.6, 24, { w: 3.3, h: 3.5, наклон: 0, зрачок: 'big' }) + ЩЁКИ(14.7, 33.3, 29.2)
      + '<circle class="nose" cx="24" cy="37.8" r="1.5"/><circle class="nose-hi" cx="23.5" cy="37.3" r=".45"/>' + УСЫ(35.4, 9),
    // Мышь: круглые уши, короткая мордочка и розовые щёки.
    mouse: '<ellipse class="fur" cx="11.4" cy="13.7" rx="8.6" ry="9.4" transform="rotate(-24 11.4 13.7)"/><ellipse class="fur" cx="36.6" cy="13.7" rx="8.6" ry="9.4" transform="rotate(24 36.6 13.7)"/>'
      + '<ellipse class="inner" cx="11.8" cy="14.1" rx="6.2" ry="7.1" transform="rotate(-24 11.8 14.1)"/><ellipse class="inner" cx="36.2" cy="14.1" rx="6.2" ry="7.1" transform="rotate(24 36.2 14.1)"/>'
      + '<path class="fur" d="M24 12.6c-8.4 0-13.2 5.2-14 11.5-2 2.3-3 4.4-3 7.1C7 38 14 41.6 24 41.6S41 38 41 31.2c0-2.7-1-4.8-3-7.1-.8-6.3-5.6-11.5-14-11.5Z"/>'
      + блик(24, 17.8, 7, 2.8) + '@УЗОР@'
      + '<path class="fur2" d="M24 32.4c-2.1-2.4-5.4-3.1-8-2-2.7 1.1-3.7 3.7-1.7 5.9 2 2 5.7 3.4 9.7 3.4s7.7-1.4 9.7-3.4c2-2.2 1-4.8-1.7-5.9-2.6-1.1-5.9-.4-8 2Z"/>'
      + ГЛАЗА(17, 31, 25.5, { w: 4, h: 4.3, наклон: 0, зрачок: 'big' })
      + '<ellipse class="inner" cx="12.4" cy="31.4" rx="3.3" ry="1.7" style="opacity:.65"/><ellipse class="inner" cx="35.6" cy="31.4" rx="3.3" ry="1.7" style="opacity:.65"/>' + УСЫ(34.3, 10.5)
      + '<path class="nose" d="M21.6 31.9c0-1.4 4.8-1.4 4.8 0 0 1.1-1.2 2.2-2.4 2.6-1.2-.4-2.4-1.5-2.4-2.6Z" style="fill:#ae647a"/><ellipse class="nose-hi" cx="23.3" cy="31.6" rx=".8" ry=".45"/>'
      + '<path class="line" d="M24 34.5v1m0 0q-1.4 1.8-3.2.9m3.2-.9q1.4 1.8 3.2.9"/>',
    // Птица: голова в три четверти, хохолок, клюв двумя створками.
    bird: '<path class="fur" d="M25 9.6c-8 0-14 6.8-14 16 0 4.4 1.4 8.4 4 11.4 2.6 3 6 4.6 10 4.6 7.4 0 12.4-6 12.4-14 0-3-.8-5.6-2-7.8 1-1.2 1.6-2.8 1.6-4.2-1.8.2-3.2-.4-4.4-1.6-2-2.8-4.6-4.4-7.6-4.4Z M24.4 9.8c-1.4-2.8-1-5.4 1.2-7-.2 2.2.6 4 2.2 5-.8-2.2-.2-4 1.6-5.2-.2 2.8.4 5.4 2.2 7.2-2.2-.2-4.6-.2-7.2 0Z"/>'
      + блик(22, 17.4, 6.6, 4.4)
      + '<path class="fur2" d="M15 37c2.6 3 6 4.6 10 4.6 4.6 0 8.4-2.4 10.4-6.4-4.4 1.2-9-.2-12-3.2-2.4-2.4-5.8-2.4-9.2-.4.2 2 .4 3.8.8 5.4Z"/>'
      + '<path class="wing" d="M12.4 30c1.6-3.4 5.6-5.2 10-4.4 3.6.6 6 3 7 6-4 1.8-9 2-13.4 1-1.4-.4-2.6-1.4-3.6-2.6Z"/><path class="feather" d="M15.6 30.8c2.4-1.4 5.4-1.6 8-.6M17 32.6c2.2-.8 4.8-.8 7 0"/>'
      + '<path class="beak" d="M34.4 20.8c3.6-.8 7.6.6 9.6 3.8-1.6-.2-3.6-.2-5.4.4-1.4-.4-3-.6-4.2-.4Z"/><path class="beak2" d="M34.6 24.6c2-.2 4.8.2 6.4 1.4-1.6 1.6-4 2-6 1.2Z"/>'
      + '<circle class="eye-ring" cx="29.8" cy="19.6" r="4.5"/><g class="eyes">' + глаз(29.8, 19.6, { w: 3.4, h: 3.6, наклон: 0, зрачок: 'big', правый: true }) + '</g>'
      + '<ellipse class="cheek" cx="26.6" cy="25" rx="2.9" ry="1.45"/>',
    // Попугай: округлый силуэт, мягкий хохолок и загнутый клюв.
    parrot: '<path class="fur" d="M20.9 10.2c-3.6-.2-6.2-2-7.4-4.5 3.8-.7 7.4.4 9.7 3.1-.9-2-.6-3.8.5-5.2 2.2 1.3 3.2 3.3 3.2 5.9 8.8.5 14.3 6.5 14.3 13.6 0 4-2.2 7.5-5.4 9.4-1 5.8-6 9-12.4 9-8.8 0-14.7-5.1-14.7-13.2C7.7 19.1 13 12 20.9 10.2Z"/>'
      + блик(20.3, 15.1, 5.6, 2.6) + '@УЗОР@'
      + '<path class="fur2" d="M22 28c3.6-2.2 7.3 1.6 10.9 1.2 1.5-.2 2.8-.7 4.1-1.5-.7 8.8-6.2 13-13.5 13-4.5 0-8.2-1.7-10.6-4.5 2.5-4.2 6-7 9.1-8.2Z"/>'
      + '<path class="wing" d="M9.8 28.2c3.6-3.7 10.4-3.1 13.6 1.5-.5 4.5-5.8 7.2-10.8 6.6-2.8-1.8-3.8-5-2.8-8.1Z"/><path class="feather" d="M12.5 30.5q3.3-2.3 7.5-.7m-6.2 3.5q3.3-.4 5.7-2.1"/>'
      + '<path class="fur2 soft" d="M35.8 15.8c-4.9-4-12.9-2.1-14.6 3.9-1.8 6 3 10.4 8.6 9.8 4-.4 7-2.4 8.1-5.4 1-2.7.1-6.5-2.1-8.3Z"/>'
      + '<ellipse class="eye-ring" cx="29.7" cy="20.7" rx="5.8" ry="5.6"/>'
      + '<g class="eyes">' + глаз(30, 20.7, { w: 4.3, h: 4.6, наклон: 0, зрачок: 'big', правый: true }) + '</g>'
      + '<ellipse class="inner" cx="25.7" cy="27.3" rx="3.2" ry="1.5" style="opacity:.65"/>'
      + '<path class="beak2" d="M36.1 25.9c2.6-.9 5.9-.5 6.8 1.9-.9 3-4.6 3.6-6.5 1.6-.7-.8-.9-2.5-.3-3.5Z"/><path class="beak" d="M36.6 22.7c1.9-1.8 5.7-1.9 7.3.3 1.5 2 .7 4.9-.8 5.9-.2-1.9-1.5-2.7-3.4-2.2-2.5.5-4.4-2.2-3.1-4Z"/>'
      + блик(40, 23.2, 1.7, .7),
    // Сова: перьевые ушки, лицевой диск, огромные глаза.
    owl: '<path class="fur" d="M10.6 11c-1-2.6-1.6-5.2-1.2-7.4 2.6 1.4 5.2 3.4 7.2 5.8 2.4-.8 4.8-1.2 7.4-1.2s5 .4 7.4 1.2c2-2.4 4.6-4.4 7.2-5.8.4 2.2-.2 4.8-1.2 7.4 3 3.4 4.2 7.8 4.2 13 0 9.6-7.6 17.6-17.6 17.6S6.4 33.6 6.4 24c0-5.2 1.2-9.6 4.2-13Z"/>'
      + блик(24, 13.6, 8, 3) + '@УЗОР@' + тень('M7.4 30c2.6 6.8 9 11.6 16.6 11.6s14-4.8 16.6-11.6c-6 6-27.2 6-33.2 0Z')
      + '<path class="fur2" d="M24 18.4c-2.2-3.6-5.4-5.2-8.6-4.8-4.6.6-6.8 4.8-6.4 9 .4 4.8 4 8 8.6 7.8 2.8-.2 5-1.6 6.4-3.8 1.4 2.2 3.6 3.6 6.4 3.8 4.6.2 8.2-3 8.6-7.8.4-4.2-1.8-8.4-6.4-9-3.2-.4-6.4 1.2-8.6 4.8Z"/>'
      + '<path class="feather" d="M16.4 34.4l1.8 1.4 1.8-1.4M22.2 36.2l1.8 1.4 1.8-1.4M28 34.4l1.8 1.4 1.8-1.4M19.2 38.4l1.6 1.2 1.6-1.2M25.4 38.4l1.6 1.2 1.6-1.2"/>'
      + '<circle class="eye-ring" cx="17.2" cy="22" r="4.6"/><circle class="eye-ring" cx="30.8" cy="22" r="4.6"/>'
      + ГЛАЗА(17.2, 30.8, 22, { w: 4.1, h: 4.1, наклон: 0, зрачок: 'big' }) + ЩЁКИ(12.8, 35.2, 27.5)
      + '<path class="beak" d="M22.4 26.2c0-.8 3.2-.8 3.2 0L24 30.8Z"/>',
    // Летучая мышь: круглая голова, большие уши, светлая маска, крылышки и клычки.
    bat: '<path class="wing2" d="M15 30c-5-4-11-4-14 0 2 .6 3.4 2 3.8 4 1.8-1.2 3.8-1.2 5.4 0 1.2-1.6 3.2-2 5-1.4Z M33 30c5-4 11-4 14 0-2 .6-3.4 2-3.8 4-1.8-1.2-3.8-1.2-5.4 0-1.2-1.6-3.2-2-5-1.4Z"/>'
      + '<path class="fur" d="M14.4 18.6C10 17.4 6.8 13.6 6.4 8.6c0-.6.4-1 1-.9 5 .8 9.8 3.2 12.8 6.4 1.2-.3 2.5-.4 3.8-.4s2.6.1 3.8.4c3-3.2 7.8-5.6 12.8-6.4.6-.1 1 .3 1 .9C41.2 13.6 38 17.4 33.6 18.6c1.8 2.2 2.9 5 2.9 8 0 6.8-5.6 12-12.5 12S11.5 33.4 11.5 26.6c0-3 1.1-5.8 2.9-8Z"/>'
      + '<path class="inner" d="M8.6 9.8c.8 3.4 3 6 6.2 7.4.8-1.2 1.8-2.2 3-3C15.4 11.8 12.2 10.4 8.6 9.8Z M39.4 9.8c-.8 3.4-3 6-6.2 7.4-.8-1.2-1.8-2.2-3-3C32.6 11.8 35.8 10.4 39.4 9.8Z"/>'
      + блик(24, 18.8, 6, 2.8) + '@УЗОР@' + тень('M13 29.6c1.4 5.2 5.6 9 11 9s9.6-3.8 11-9c-4 4.6-18 4.6-22 0Z')
      + '<path class="fur2" d="M24 22C21.6 19.4 16.6 19.6 15.4 23.6c-1 3.6 1 7.6 4.6 9.6 1.4.8 2.8 1.2 4 1.2s2.6-.4 4-1.2c3.6-2 5.6-6 4.6-9.6C31.4 19.6 26.4 19.4 24 22Z"/>'
      + ГЛАЗА(19.2, 28.8, 25.4, { w: 3.1, h: 3.35, наклон: -.1, зрачок: 'big' }) + ЩЁКИ(15.4, 32.6, 29.8)
      + '<path class="nose" d="M22.8 29.4c0-.7 2.4-.7 2.4 0 0 .7-.7 1.3-1.2 1.5-.5-.2-1.2-.8-1.2-1.5Z"/>'
      + '<path class="line" d="M21.2 31.6c1.6 1.6 4 1.6 5.6 0"/><path class="fang" d="M22.2 32.3l.5 1.1.5-.8Z M25.3 32.6l.5.8.5-1.1Z"/>',
    // Змея: кольца тела, шея поднимается к голове.
    snake: '<path class="fur" d="M7 39.6c0-4 7.6-6.2 17-6.2s17 2.2 17 6.2-7.6 6-17 6-17-2-17-6Z"/>' + тень('M7 39.6c0 4 7.6 6 17 6s17-2 17-6c-3.4 3-30.6 3-34 0Z')
      + '<path class="belly-band" d="M11.4 39.6c3.4 1.6 21.8 1.6 25.2 0"/><path class="scale" d="M10 37.8q3-2 6 0M18.6 37q3-2 6 0M27.4 37.8q3-2 6 0"/>'
      + '<path class="neck" d="M22 37c-5-5-3.4-10 1-13 3.6-2.4 4.4-4.4 3.8-7"/><path class="belly" d="M22.6 36c-4.2-4.4-2.8-8.6 1-11.2"/>'
      + '<path class="fur" d="M26.6 6.2c5 0 8.8 3 8.8 6.8 0 3.4-3.2 6.4-7.8 7-1.6.2-3.2 0-4.6-.6-4-1.6-6-4-5.6-6.8.4-3.8 4.2-6.4 9.2-6.4Z"/>'
      + блик(26.4, 9.4, 5, 2) + '<path class="scale" d="M22 9.2q2-1.4 4 0M26.6 8.4q2-1.4 4 0M24.2 12q2-1.4 4 0"/>'
      + ГЛАЗА(21.8, 30.8, 12.4, { w: 2.9, h: 2.85, наклон: .12, зрачок: 'big' }) + ЩЁКИ(18.9, 33.6, 16.5)
      + '<path class="nostril" d="M25.4 16.6h.01M28 16.4h.01"/><path class="tongue" d="M26.6 19.8v3.4M26.6 23.2l-1.6 1.6M26.6 23.2l1.6 1.6" fill="none"/>',
    // Робот: корпус-монитор с визором, антенна, болты.
    robot: '<path class="antenna" d="M24 9.6V4.6"/><circle class="led" cx="24" cy="3.6" r="1.8"/>'
      + '<path class="ear" d="M5.4 18.6c0-.6.4-1 1-1h2.6v9H6.4c-.6 0-1-.4-1-1Z M42.6 18.6c0-.6-.4-1-1-1H39v9h2.6c.6 0 1-.4 1-1Z"/>'
      + '<rect class="fur" x="9" y="9.6" width="30" height="27" rx="8.4"/>' + блик(24, 13.4, 10, 2.6) + тень('M9 28c0 5 3.8 8.6 8.4 8.6h13.2c4.6 0 8.4-3.6 8.4-8.6-5 3.6-25 3.6-30 0Z')
      + '<rect class="visor" x="12.6" y="15" width="22.8" height="11.4" rx="5.7"/><path class="visor-hi" d="M15 17.4c4-1.4 14-1.4 18 0"/>'
      + '<g class="eyes"><rect class="eye bot" x="16.3" y="17.8" width="5.4" height="5.8" rx="2.7"/><rect class="eye bot r" x="26.3" y="17.8" width="5.4" height="5.8" rx="2.7"/><circle class="glint" cx="18.1" cy="19.4" r=".8"/><circle class="glint" cx="28.1" cy="19.4" r=".8"/></g>'
      + ЩЁКИ(14.4, 33.6, 28.9) + '<path class="line" d="M21 29.8q3 3.2 6 0"/><circle class="bolt" cx="12.6" cy="13" r=".9"/><circle class="bolt" cx="35.4" cy="13" r=".9"/>'
      + '<path class="fur2" d="M18 36.6h12v4.4c0 .6-.4 1-1 1H19c-.6 0-1-.4-1-1Z"/>',
    // Дракон: рога, гребни-бахрома на щеках, золотые глаза с щелью.
    dragon: '<path class="horn" d="M16.4 12.4C13 9.4 11.4 5.4 12 1.6c2.6 3 5.6 5.8 8.4 8Z M31.6 12.4C35 9.4 36.6 5.4 36 1.6c-2.6 3-5.6 5.8-8.4 8Z"/><path class="horn-line" d="M14.6 7.4l2.2-.8M13.4 4.6l1.8-.6M33.4 7.4l-2.2-.8M34.6 4.6l-1.8-.6"/>'
      + '<path class="fur" d="M24 9c-5.6 0-10 3.6-11 8.6-2.6 1-4.6 2.8-5.6 5.2 2 .2 3.6 1 4.8 2.2.4 3.4 1.4 6.4 3.2 9 2 3.6 5 6.4 8.6 6.4s6.6-2.8 8.6-6.4c1.8-2.6 2.8-5.6 3.2-9 1.2-1.2 2.8-2 4.8-2.2-1-2.4-3-4.2-5.6-5.2-1-5-5.4-8.6-11-8.6Z"/>'
      + блик(24, 15.6, 7, 3.4) + '@УЗОР@' + тень('M15.4 34c2 3.6 5 6.4 8.6 6.4s6.6-2.8 8.6-6.4c-4 2.8-13.2 2.8-17.2 0Z')
      + '<path class="fur2" d="M18 31c0-3 2.6-4.4 6-4.4s6 1.4 6 4.4c0 4.4-2.6 7.6-6 7.6s-6-3.2-6-7.6Z"/>'
      + '<path class="scale" d="M20 13.8q4-2 8 0M18 17.2q6-2.6 12 0M15 19.6c2-1.4 4.6-1.4 6.4 0M33 19.6c-2-1.4-4.6-1.4-6.4 0"/>'
      + ГЛАЗА(18.2, 29.8, 22.6, { w: 3.5, h: 3.55, наклон: .18, зрачок: 'big', класс: ' gold' }) + ЩЁКИ(14.4, 33.6, 28.3)
      + '<path class="nostril" d="M22 33h.01M26 33h.01"/><path class="line" d="M20.6 36c2 1 4.8 1 6.8 0"/>',
    // Дух: огонёк-капля с внутренним светом и искрами.
    spirit: '<path class="glow" d="M24 3c6.6 7.4 15 11.4 15 23 0 9.4-6.8 15.6-15 15.6S9 35.4 9 26C9 14.4 17.4 10.4 24 3Z"/>'
      + '<path class="fur" d="M24 7c5 6.4 12 10 12 19.6 0 7.6-5.4 12.6-12 12.6s-12-5-12-12.6C12 17 19 13.4 24 7Z"/>'
      + '<path class="fur2" d="M24 15.6c3 4 6.4 6.6 6.4 11.8 0 4.2-2.8 7-6.4 7s-6.4-2.8-6.4-7c0-5.2 3.4-7.8 6.4-11.8Z"/>' + блик(21, 18, 2.6, 4.4)
      + ГЛАЗА(20.6, 27.4, 26, { w: 2.75, h: 3.15, наклон: 0, зрачок: 'big' }) + ЩЁКИ(16.8, 31.2, 29) + '<path class="line" d="M22 31c1 .8 3 .8 4 0"/>'
      + '<circle class="spark" cx="39" cy="12" r="1.2"/><circle class="spark" cx="9" cy="17" r=".9"/><circle class="spark" cx="36" cy="36" r=".7"/>',
    // Существо без вида: мягкая капля с румянцем.
    blob: '<path class="fur" d="M8 32c0-11 7-20 16-20s16 9 16 20c0 6-6 9-16 9S8 38 8 32Z"/>' + блик(19, 20, 5, 3.4) + тень('M8.6 34.4C10 39 15.6 41 24 41s14-2 15.4-6.6c-5 3.6-25.8 3.6-30.8 0Z')
      + ГЛАЗА(19, 29, 28, { w: 3.25, h: 3.55, наклон: 0, зрачок: 'big' }) + ЩЁКИ(14.6, 33.4, 32.8) + '<path class="line" d="M22 34c1.2 1 2.8 1 4 0"/>',
  };
  let форма = род;
  if (род === 'rodent' && /мыш|\b(?:mouse|mice)\b/i.test(s)) форма = 'mouse';
  if (род === 'bird' && /попуга|\bparrot(?:s|let)?\b/i.test(s)) форма = 'parrot';
  const рисунок = (П[форма] || П.blob).replace('@УЗОР@', узор && УЗОР[узор] ? УЗОР[узор] : '');
  const ошейник = род === 'cat' || род === 'dog' ? ОШЕЙНИК : '';
  const рамка = {
    cat: '-1 1 50 50', dog: '-1 4 50 50', wolf: '-1 -2 50 50', lynx: '-2 -4 52 52',
    bird: '2 -2 48 48', parrot: '2 -2 48 48', bat: '-4 -6 56 56',
    snake: '-1 -1 52 52', spirit: '0 -2 48 48', blob: '0 2 48 48',
  }[форма] || '0 -1 48 48';
  return `<svg class="hud-pet2-face" viewBox="${рамка}" aria-hidden="true">${рисунок}${ошейник}</svg>`;
}

// Время кормления из рациона: «покормлена в 19:00», «ужинал в 19:45».
const времяКорма = (рацион) => (String(рацион || '').match(/(\d{1,2}[:.]\d{2})/) || [])[1] || '';
// Здоровье одним словом по состоянию: зелёное «здоров», жёлтое «устал», красное «ранен».
function здоровье(состояние, механизм) {
  const s = String(состояние || '').toLowerCase();
  if (!s) return null;
  if (/ранен|травм|кров|перелом|хромает|рана|wound|injur|bleed|broken leg|limp/.test(s)) return ['bad', 'ранен'];
  if (/болен|болезн|лихорад|отрав|кашля|sick|\bill\b|fever|poison/.test(s)) return ['bad', 'болен'];
  if (механизм && /слом|поврежд|сбой|застрял|broken|damaged|glitch|stuck|error/.test(s)) return ['bad', 'сбой'];
  if (/устал|вымот|слаб|хандр|tired|exhausted|weak/.test(s)) return ['mid', 'устал'];
  if (/здоров|в порядке|в норме|цел|бодр|отлич|healthy|fine|well|unharmed/.test(s)) return ['ok', механизм ? 'исправен' : 'здоров'];
  return null;
}
const СЛЕДЫ = {
  paw: '<path d="M6 9.4c-1.8 0-3.2-1.2-3.2-2.6S4.6 4.4 6 4.4s3.2 1.4 3.2 2.4S7.8 9.4 6 9.4Z"/><circle cx="2.6" cy="3.2" r="1.1"/><circle cx="4.8" cy="1.6" r="1.1"/><circle cx="7.4" cy="1.6" r="1.1"/><circle cx="9.5" cy="3.2" r="1.1"/>',
  bird: '<path d="M6 10V5M6 5 2.6 1.6M6 5V.6M6 5l3.4-3.4" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>',
  hoof: '<path d="M2 9.6C1.4 5 3 1.4 6 1.4S10.6 5 10 9.6H8.2C8.4 6.6 7.6 4 6 4S3.6 6.6 3.8 9.6Z"/>',
  wave: '<path d="M1 6c2-3 3-3 5 0s3 3 5 0" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  track: '<rect x="2" y="2" width="8" height="2.2" rx="1"/><rect x="2" y="6.4" width="8" height="2.2" rx="1"/>',
  spark: '<path d="M6 .6 7.2 4.3 11 5.5 7.2 6.7 6 10.4 4.8 6.7 1 5.5 4.8 4.3Z"/>',
};
const СЛЕД_РОДА = { robot: 'track', bird: 'bird', owl: 'bird', spirit: 'spark', bat: 'spark', horse: 'hoof', snake: 'wave' };

/**
 * Карточка спутника. внешность — { окрас: { мех, мех2, узор }, глаза: [л, п] }
 * из render/pet-looks.js: названное в этом ходе или запомненное раньше.
 */
// Реалистичный портрет ссылается на свои градиенты и фильтры по id — у каждой карточки свои.
let номерПортрета = 0;
export function карточкаСпутника(p, значок, связь, связьHTML = '', внешность = null) {
  const род = родПортрета(p.species, p.name), механизм = род === 'robot';
  const окрас = (внешность && внешность.окрас) || {};
  const [мехРода, мех2Рода] = ОКРАС_РОДА[род] || ОКРАС_РОДА.blob;
  const мех = окрас.мех || мехРода, мех2 = окрас.мех2 || мех2Рода;
  const узор = окрас.узор || (УЗОР_ВИДА.find(([rx]) => rx.test(String(p.species || ''))) || [])[1] || '';
  const глаза = внешность && Array.isArray(внешность.глаза) ? внешность.глаза : null;
  const стиль = `--fur:${мех};--fur2:${мех2}` + (глаза ? `;--eye:${глаза[0]};--eye2:${глаза[1] || глаза[0]}` : '');
  const плитка = (к, подпись, текст, класс = '') => есть(текст) ? `<div class="hud-pet2-tile${класс}"><span>${ик(к)}${подпись}</span><p>${escapeHtml(String(текст))}</p></div>` : '';
  // Настроение видно на плашке сверху; целиком — плиткой, если там не уместилось.
  const плитки = плитка('cond', 'Состояние', p.condition) + плитка('food', механизм ? 'Питание' : 'Рацион', p.diet)
    + плитка('wish', 'Хочет', p.wants, ' is-wish') + плитка('candy', 'Любимое лакомство', p.treat, ' is-treat')
    + (есть(p.mood) && String(p.mood).length > 26 ? плитка('smile', 'Настроение', p.mood, ' is-mood') : '');
  const умения = есть(p.skills) ? лучшиеУмения(p.skills) : [];
  const здор = здоровье(p.condition, механизм), корм = механизм ? '' : времяКорма(p.diet);
  const значки = (есть(p.age) ? `<span class="chip age" title="Возраст">${ик('cake')}<span data-i18n-skip>${escapeHtml(String(p.age))}</span></span>` : '')
    + (здор ? `<span class="chip h-${здор[0]}">${ик(здор[0] === 'ok' ? 'shield' : 'cond')}${здор[1]}</span>` : '')
    + (корм ? `<span class="chip fed" title="Когда ел">${ик('food')}ел в ${escapeHtml(корм.replace('.', ':'))}</span>` : '');
  // Духу и фамильяру сытость и чистота ни к чему — только силы и настроение.
  const нужды = потребностиСпутника(p, механизм).filter(н => род !== 'spirit' || н.к === 'energy' || н.к === 'mood');
  const шкалы = `<div class="hud-pet2-needs">${нужды.map(н => `<div class="nd" style="--c:${н.c}" title="${н.имя}: ${н.n} из 5">${ик(н.ик)}<span>${н.имя}</span><b><i style="width:${н.n * 20}%"></i></b></div>`).join('')}</div>`;
  const след = СЛЕДЫ[СЛЕД_РОДА[род] || 'paw'];
  const тропа = `<div class="hud-pet2-trail" aria-hidden="true">${Array.from({ length: 6 }, (_, i) => `<svg class="pr" viewBox="0 0 12 11" style="--i:${i}">${след}</svg>`).join('')}</div>`;
  // Цвет карточки — цвет темы (css/extras.css, --p); окрас и глаза — у портрета.
  return `<div class="hud-pet2 k-${род}${глаза ? ' has-eyes' : ''}" style="${стиль}"><div class="hud-pet2-band"><i class="pat" aria-hidden="true"></i></div>`
    + `<div class="hud-pet2-top"><div class="hud-pet2-ava">${settings.petPortrait === 'real' ? реальныйПортрет(род, p.species, узор, 'pc' + (++номерПортрета)) : портретСпутника(род, p.species, узор)}</div>`
    + `<div class="hud-pet2-nm"><b>${escapeHtml(p.name)}</b>${есть(p.species) ? `<small>${escapeHtml(p.species)}</small>` : ''}</div>${есть(p.mood) ? `<span class="hud-pet2-mood" title="${escapeHtml(String(p.mood))}">${escapeHtml(p.mood)}</span>` : ''}</div>`
    + (значки ? `<div class="hud-pet2-chips">${значки}</div>` : '')
    + (есть(p.owner) ? `<div class="hud-pet2-own">${лицоХозяина(имяХозяина(p.owner))}<span>хозяин: <b>${escapeHtml(p.owner)}</b></span></div>` : '')
    + (связьHTML ? `<div class="hud-pet2-bondrow">${связьHTML}</div>` : '')
    + шкалы
    + (плитки ? `<div class="hud-pet2-tiles">${плитки}</div>` : '')
    + (есть(p.note) ? `<div class="hud-pet2-now">${ик('note')}<span>Сейчас: ${escapeHtml(String(p.note))}</span></div>` : '')
    + (Array.isArray(p.extra) && p.extra.length ? `<div class="hud-pet2-extra">${p.extra.map(д => `<span><b>${escapeHtml(д.key)}:</b> ${escapeHtml(String(д.value))}</span>`).join('')}</div>` : '')
    + (умения.length ? `<div class="hud-pet2-skills">${умения.map(у => `<span>${escapeHtml(у)}</span>`).join('')}</div>` : '')
    + тропа + `</div>`;
}
let тамId = 0;
export function тамагочи(p, связь, связьHTML = '') {
  const видК = видСпутника(p.species, p.name), тип = СПРАЙТЫ[видК];
  const id = 'hud-tama-' + (++тамId).toString(36);
  const w = тип.сп[0].length, px = 44 / w;
  const пиксели = тип.сп.flatMap((r, y) => [...r].map((ch, x) => тип.пал[ch] ? `<rect x="${(43 + x * px).toFixed(2)}" y="${(58 + y * px).toFixed(2)}" width="${(px + 0.1).toFixed(2)}" height="${(px + 0.1).toFixed(2)}" fill="${тип.пал[ch]}"/>` : '')).join('');
  const имяЭкран = escapeHtml(String(p.name || '').toUpperCase().slice(0, 12));
  const dev = `<svg class="hud-tama-dev" viewBox="0 0 130 150" aria-hidden="true"><defs><radialGradient id="${id}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="${тип.цвет}" stop-opacity=".6"/><stop offset="1" stop-color="${тип.цвет}" stop-opacity=".95"/></radialGradient>`
    + `<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9f3c8"/><stop offset="1" stop-color="#c5d69a"/></linearGradient></defs>`
    + `<path d="M65 5c36 0 59 36 59 76 0 38-26 65-59 65S6 119 6 81C6 41 29 5 65 5Z" fill="url(#${id})" stroke="rgba(255,255,255,.6)" stroke-width="1.4"/><path d="M30 30c8-13 20-19 34-19" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".5"/>`
    + `<rect x="30" y="40" width="70" height="66" rx="8" fill="#2a2430" opacity=".85"/><rect x="36" y="46" width="58" height="54" rx="4" fill="url(#${id}s)"/>`
    + пиксели + `<text x="65" y="54" text-anchor="middle" font-family="Courier New, monospace" font-size="5.5" font-weight="700" fill="#4a5a2a">${имяЭкран}</text>`
    + [44, 65, 86].map(x => `<circle cx="${x}" cy="124" r="6.5" fill="${тип.цвет}" fill-opacity=".45" stroke="rgba(0,0,0,.25)"/><circle cx="${x - 2}" cy="122" r="2" fill="#fff" opacity=".6"/>`).join('')
    + `<circle cx="65" cy="10" r="5" fill="none" stroke="#9aa1ab" stroke-width="2.2"/></svg>`;
  const статы = потребностиСпутника(p, !!тип.mech);
  // Особый вид привязанности (сердца, лапа, жетон) — вместо пиксельной шкалы.
  if (связь !== null && !связьHTML) статы.push({ имя: 'Привязанность', ик: 'heart', c: '#ef5a8a', n: огр(Math.round(связь / 20), 0, 5) });
  const реплика = есть(p.note) ? '▸ ' + String(p.note) : есть(p.mood) ? '▸ ' + String(p.mood) : '';
  // Всё, что есть в карточке, есть и здесь: хозяин, состояние, рацион,
  // настроение (если «Сейчас» уже занято им), прочие поля и умения.
  const строка = (подпись, текст) => есть(текст) ? `<span><b>${подпись}:</b> ${escapeHtml(String(текст))}</span>` : '';
  const умения = есть(p.skills) ? лучшиеУмения(p.skills) : [];
  const сведения = строка('Возраст', p.age) + строка('Хозяин', p.owner) + строка('Состояние', p.condition) + строка('Рацион', p.diet) + строка('Хочет', p.wants) + строка('Любимое лакомство', p.treat)
    + (есть(p.note) ? строка('Настроение', p.mood) : '')
    + (Array.isArray(p.extra) ? p.extra.map(д => строка(escapeHtml(д.key), д.value)).join('') : '');
  const низ = (сведения || умения.length) ? `<div class="hud-tama-info">${сведения}${умения.length ? `<div class="hud-tama-skills">${умения.map(у => `<i>${escapeHtml(у)}</i>`).join('')}</div>` : ''}</div>` : '';
  return `<div class="hud-tama">${dev}<div class="hud-tama-stats"><b>${escapeHtml(p.name)}</b>${есть(p.species) ? `<small>${escapeHtml(p.species)}</small>` : ''}`
    + статы.map(s => `<div class="hud-tama-st" style="--c:${s.c}">${ик(s.ик, s.c)}<span>${s.имя}</span><span class="hud-tama-px">${Array.from({ length: 5 }, (_, i) => `<i${i < s.n ? '' : ' class="off"'}></i>`).join('')}</span></div>`).join('')
    + (связьHTML || '') + (реплика ? `<div class="hud-tama-say">${escapeHtml(реплика)}</div>` : '') + `</div>${низ}</div>`;
}
