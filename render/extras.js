// hud-manager/render/extras.js
//
// Новые блоки карточки: фаза луны в сцене, титры в конце, состояние тела,
// поворот сюжета, спутник карточкой и тамагочи. Всё здесь — чистые функции
// «данные → разметка»; оформление живёт в css/extras.css.

import { escapeHtml, hudHasMeaningfulValue, инициалыИмени } from '../utils.js?v=23.89.24';
import { settings } from '../settings.js?v=23.89.24';
import { аватаркаПоИмени } from './views.js?v=23.89.24';

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
];
export function разобратьСостояниеТела(value) {
  const шкалы = [], текст = { сон: '', дела: '', прочее: [] };
  String(value || '').split(/;|\n/).map(s => s.trim()).filter(Boolean).forEach(часть => {
    const m = часть.match(/^([^:]{1,24}):\s*(.+)$/);
    const метка = m ? m[1].trim() : '', тело = m ? m[2].trim() : часть;
    const ш = ШКАЛЫ.find(x => x.rx.test(метка));
    if (ш) {
      const n = число(тело);
      const слово = тело.replace(/^\s*-?\d+(?:[.,]\d+)?\s*%?\s*[—–:-]?\s*/, '').trim();
      if (Number.isFinite(n)) шкалы.push({ ...ш, v: огр(Math.round(n), 0, 100), слово });
      return;
    }
    if (/^сон|^slp|sleep/i.test(метка)) текст.сон = тело;
    else if (/^дел|^dut|работ|учёб|учеб|work|duties|school|study|classes/i.test(метка)) текст.дела = тело;
    else текст.прочее.push(часть);
  });
  ШКАЛЫ.forEach((ш, i) => { const н = шкалы.findIndex(x => x.к === ш.к); if (н > -1) шкалы[н].i = i; });
  шкалы.sort((a, b) => a.i - b.i);
  return { шкалы, ...текст };
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
    + `</svg><b>${s.v}</b><small>${s.имя}</small>${s.слово ? `<em>${escapeHtml(s.слово)}</em>` : ''}</div>`;
}
function колба(s) {
  const id = нид('f'), y = 60 - 40 * s.v / 100;
  const форма = 'M18 6h12v16c9 3 14 11 14 20 0 12-9 20-20 20S4 54 4 42c0-9 5-17 14-20Z';
  return `<div class="hud-bs-cell" style="--c:${s.c}"><svg viewBox="0 0 48 66" aria-hidden="true"><defs><clipPath id="${id}"><path d="${форма}"/></clipPath>`
    + `<linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.c}" stop-opacity=".95"/><stop offset="1" stop-color="${s.c}" stop-opacity=".6"/></linearGradient></defs>`
    + `<g clip-path="url(#${id})"><rect x="0" y="${y.toFixed(1)}" width="48" height="70" fill="url(#${id}g)"/><ellipse cx="24" cy="${y.toFixed(1)}" rx="20" ry="2" fill="#fff" opacity=".35"/>`
    + (s.v > 25 ? `<circle class="bub" cx="16" cy="${(y + 10).toFixed(1)}" r="1.4"/><circle class="bub" cx="28" cy="${(y + 16).toFixed(1)}" r="1"/>` : '') + `</g>`
    + `<path class="glass" d="${форма}"/><rect class="cork" x="16" y="1" width="16" height="6" rx="2"/><path class="shine" d="M10 36c0-5 2-8 6-10"/></svg>`
    + `<b>${s.v}</b><small>${s.имя}</small>${s.слово ? `<em>${escapeHtml(s.слово)}</em>` : ''}</div>`;
}
export function видСостоянияТела(value, вид) {
  const д = разобратьСостояниеТела(value);
  if (!д.шкалы.length && !д.сон && !д.дела) return '';
  const бок = (д.сон || д.дела) ? `<div class="hud-bs-side">${д.сон ? `<div class="hud-bs-sleep">${ЛУНА_СНА}<div><b>${escapeHtml(д.сон)}</b><small>сон прошлой ночью</small></div></div>` : ''}${д.дела ? `<div class="hud-bs-work">${escapeHtml(д.дела)}</div>` : ''}</div>` : '';
  const прочее = д.прочее.length ? `<p class="hud-bs-note">${escapeHtml(д.прочее.join('; '))}</p>` : '';
  if (вид === 'chips') {
    return `<div class="hud-bs hud-bs-chips">${д.шкалы.map(s => `<span class="hud-bs-chip" style="--c:${s.c}"><i>${s.v}</i>${s.имя}${s.слово ? `: <b>${escapeHtml(s.слово)}</b>` : ''}</span>`).join('')}`
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
  horse: ['#7a5232', '#a8784f'], rabbit: ['#b8a894', '#ece4d8'], rodent: ['#8f8a86', '#d6d0ca'], bird: ['#4a5a8a', '#8fa0c8'],
  owl: ['#8a6a48', '#d8c4a4'], bat: ['#4a4048', '#7a6e76'], snake: ['#4a8a4a', '#a8d090'], robot: ['#8fa6c0', '#d4dee9'],
  dragon: ['#3f9a6a', '#8fd0a6'], spirit: ['#9a86e0', '#d6ccff'], blob: ['#e0708f', '#f6b4c6'],
};
// Узор по умолчанию у пород, где он часть вида: тигр полосатый, барс пятнистый.
const УЗОР_ВИДА = [[/тигр|tiger|зебр|zebra/i, 'stripes'], [/леопард|барс|ягуар|гепард|оцелот|рысь|далматин|leopard|jaguar|cheetah|ocelot|dalmatian/i, 'spots']];

// Портрет 48×48 по роду: шерсть — var(--fur), светлое — var(--fur2), цвет темы — var(--p),
// глаза — var(--eye) и var(--eye2) (правый: гетерохромия). Глаза моргают,
// сам портрет чуть дышит (css/extras.css, .hud-pet2-ava).
const ГЛАЗА = (x1, x2, y, r = 2.2) => `<g class="eyes"><ellipse class="eye" cx="${x1}" cy="${y}" rx="${r}" ry="${r * 1.15}"/><ellipse class="eye r" cx="${x2}" cy="${y}" rx="${r}" ry="${r * 1.15}"/><circle class="pupil" cx="${x1}" cy="${y + .2}" r="${(r * .45).toFixed(2)}"/><circle class="pupil" cx="${x2}" cy="${y + .2}" r="${(r * .45).toFixed(2)}"/><circle class="glint" cx="${x1 + .7}" cy="${y - .8}" r=".7"/><circle class="glint" cx="${x2 + .7}" cy="${y - .8}" r=".7"/></g>`;
const ОШЕЙНИК = '<path class="collar" d="M13 41c6 3.4 16 3.4 22 0l.8 3.2c-6.6 3.4-16.8 3.4-23.6 0Z"/><circle class="tag" cx="24" cy="46" r="2.6"/>';
// Узоры поверх меха: на лбу и щеках, у лошади — по морде.
const УЗОР = {
  stripes: '<path class="mark" d="M20.4 14.6 22 19M24 13.6V18.6M27.6 14.6 26 19M10.6 25.4l4.4 1M10.6 28.6l4.4-.2M37.4 25.4l-4.4 1M37.4 28.6l-4.4-.2"/>',
  spots: '<g class="mark-f"><circle cx="16" cy="18.6" r="1.5"/><circle cx="31.4" cy="17.4" r="1.2"/><circle cx="13.4" cy="29.6" r="1.1"/><circle cx="34.6" cy="29" r="1.4"/><circle cx="27.6" cy="13.8" r=".9"/><circle cx="20" cy="13.6" r="1"/></g>',
  patches: '<path class="patch a" d="M10 22c0-6 3-10 8-11 2 3 2 8-1 11-2 2-5 2-7 0Z"/><path class="patch b" d="M38 26c0 4-2 7-6 8-2-3-1-7 2-9 1.4-.8 3-.4 4 1Z"/>',
};
function портретСпутника(род, вид, узор) {
  const s = String(вид || '');
  const рысь = /рыс|lynx|каракал|caracal/i.test(s), рог = /единорог|unicorn/i.test(s), крылья = /пегас|pegasus|крылат/i.test(s);
  const кот = '<path class="fur" d="M9 9 14 19C11 22 10 26 10 29c0 8 6.3 13 14 13s14-5 14-13c0-3-1-7-4-10l5-10-10 5c-1.6-.5-3.3-.8-5-.8s-3.4.3-5 .8Z"/>';
  const П = {
    cat: кот + '<path class="inner" d="M11.6 12.6 15 18.4 18 16.4Z M36.4 12.6 33 18.4 30 16.4Z"/>'
      + (рысь ? '<path class="tuft" d="M9 9 8 4.6M39 9l1-4.4"/>' : '') + '@УЗОР@'
      + '<path class="fur2" d="M17 31c0-3 3-4.6 7-4.6s7 1.6 7 4.6c0 4.2-3.2 7-7 7s-7-2.8-7-7Z"/>' + ГЛАЗА(18.6, 29.4, 25)
      + '<path class="nose" d="M22.4 29h3.2L24 31Z"/><path class="line" d="M24 31v1.6M24 32.6c-1 1.2-2.4 1.2-3.2.4M24 32.6c1 1.2 2.4 1.2 3.2.4"/>'
      + '<path class="whisk" d="M17 31.6 8 30M17 33 8.6 34.4M31 31.6 40 30M31 33l8.4 1.4"/>',
    dog: '<path class="ear" d="M13 12c-5 1-7 9-5 16 1.4 3.6 4.6 3 5.6-.4l2-9Z M35 12c5 1 7 9 5 16-1.4 3.6-4.6 3-5.6-.4l-2-9Z"/>'
      + '<path class="fur" d="M12 22c0-8 5-12.6 12-12.6S36 14 36 22v6c0 8-5.4 13.4-12 13.4S12 36 12 28Z"/>' + '@УЗОР@'
      + '<path class="fur2" d="M17 31c0-3.6 3-5.4 7-5.4s7 1.8 7 5.4c0 4.6-3.2 8-7 8s-7-3.4-7-8Z"/>' + ГЛАЗА(18.6, 29.4, 22.6)
      + '<path class="nose" d="M21.4 28.4c0-1.4 5.2-1.4 5.2 0 0 1.6-1.6 2.6-2.6 2.6s-2.6-1-2.6-2.6Z"/><path class="line" d="M24 31v1.8M24 32.8c-1.2 1.4-3 1.4-3.8.4M24 32.8c1.2 1.4 3 1.4 3.8.4"/>'
      + '<path class="tongue" d="M22.6 34.6h2.8c0 2.4-.6 3.4-1.4 3.4s-1.4-1-1.4-3.4Z"/>',
    fox: '<path class="fur" d="M7 7 15 17C12 20 11 24 11 27c0 3 1 5 3 7l10 8 10-8c2-2 3-4 3-7 0-3-1-7-4-10l8-10-12 6c-1.6-.4-3.4-.6-5-.6s-3.4.2-5 .6Z"/>'
      + '<path class="tip" d="M7 7l3 5.4 3-2Z M41 7l-3 5.4-3-2Z"/><path class="inner" d="M10.4 11 14.4 16.6 17 15Z M37.6 11l-4 5.6L31 15Z"/>' + '@УЗОР@'
      + '<path class="fur2" d="M11 27c3-1 7 0 9 3l4 3 4-3c2-3 6-4 9-3-1 4-4 7-7 9l-6 5-6-5c-3-2-6-5-7-9Z"/>' + ГЛАЗА(18.2, 29.8, 24, 2)
      + '<path class="nose" d="M22.6 35.4h2.8L24 37.2Z"/><path class="whisk" d="M19 34 10 33M29 34l9-1"/>',
    bear: '<circle class="ear" cx="12" cy="13" r="5"/><circle class="ear" cx="36" cy="13" r="5"/><circle class="inner" cx="12" cy="13" r="2.4"/><circle class="inner" cx="36" cy="13" r="2.4"/>'
      + '<path class="fur" d="M9 26c0-9 6.4-14 15-14s15 5 15 14c0 9-6.6 15-15 15S9 35 9 26Z"/>' + '@УЗОР@'
      + '<path class="fur2" d="M17 31c0-3.4 3-5 7-5s7 1.6 7 5c0 4-3.2 6.6-7 6.6S17 35 17 31Z"/>' + ГЛАЗА(18, 30, 23.6, 1.9)
      + '<path class="nose" d="M21.6 29.4c0-1.6 4.8-1.6 4.8 0 0 1.4-1.4 2.4-2.4 2.4s-2.4-1-2.4-2.4Z"/><path class="line" d="M24 31.8v1.6M24 33.4c-1 1-2.4 1-3 .2M24 33.4c1 1 2.4 1 3 .2"/>',
    horse: (рог ? '<path class="horn" d="M24 1 22 11h4Z"/><path class="line" d="M22.6 8.4h2.8M23 5.4h2"/>' : '')
      + '<path class="ear" d="M15 13 13 4l6 6Z M33 13l2-9-6 6Z"/>'
      + (крылья ? '<path class="wing2" d="M9 24C2 20 1 12 3 8c3 5 6 7 9 8Z M39 24c7-4 8-12 6-16-3 5-6 7-9 8Z"/>' : '')
      + '<path class="fur" d="M15 15c0-4 4-6 9-6s9 2 9 6l-1 18c0 5-3.6 9-8 9s-8-4-8-9Z"/>' + '@УЗОР@'
      + '<path class="mane" d="M24 7c-3 0-6 1-7.4 3.4 2-.6 4-.6 5.4 0-1 1.4-1.4 3-1.2 4.6 1.4-2.4 3.6-3.6 6-3.6Z"/>'
      + '<path class="fur2" d="M23 15c-.4 5-.6 9 0 14h2c.6-5 .4-9 0-14Z"/><path class="muzzle" d="M17 33c0-2.6 3-4 7-4s7 1.4 7 4c0 4-3 7.6-7 7.6S17 37 17 33Z"/>'
      + ГЛАЗА(17.6, 30.4, 21, 1.8) + '<path class="nostril" d="M20.6 35.4c.8-.4 1.6-.4 2 .4M27.4 35.4c-.8-.4-1.6-.4-2 .4"/>',
    rabbit: '<path class="ear" d="M17 21C14 13 14 4 17.6 3c3 1 3 10 1.6 18Z M31 21c3-8 3-17-.6-18-3 1-3 10-1.6 18Z"/>'
      + '<path class="inner" d="M17.4 18.4c-1.6-5-1.6-11 .2-12.4 1.4 1.4 1.4 7.4.6 12.4Z M30.6 18.4c1.6-5 1.6-11-.2-12.4-1.4 1.4-1.4 7.4-.6 12.4Z"/>'
      + '<path class="fur" d="M11 30c0-7.6 5.6-12 13-12s13 4.4 13 12c0 7-5.8 11.4-13 11.4S11 37 11 30Z"/>' + '@УЗОР@'
      + '<path class="fur2" d="M18 33.6c0-2.6 2.6-4 6-4s6 1.4 6 4c0 3-2.6 5-6 5s-6-2-6-5Z"/>' + ГЛАЗА(18, 30, 27.4, 2.1)
      + '<path class="nose" d="M22.8 31.4h2.4L24 33Z"/><path class="tooth" d="M23 34.6h2v2.4h-2Z"/><path class="whisk" d="M19 33 11 31.6M29 33l8-1.4"/>',
    rodent: '<circle class="ear" cx="13" cy="14" r="6"/><circle class="ear" cx="35" cy="14" r="6"/><circle class="inner" cx="13" cy="14" r="3.4"/><circle class="inner" cx="35" cy="14" r="3.4"/>'
      + '<path class="fur" d="M12 26c0-7 5-11 12-11s12 4 12 11c0 5-3 8-7 11l-5 4-5-4c-4-3-7-6-7-11Z"/>' + '@УЗОР@'
      + '<path class="fur2" d="M17 30c2-2 4.4-3 7-3s5 1 7 3c-1.4 3.4-4 6.4-7 8.4-3-2-5.6-5-7-8.4Z"/>' + ГЛАЗА(18.6, 29.4, 24.4, 1.9)
      + '<circle class="nose" cx="24" cy="36.4" r="1.6"/><path class="whisk" d="M21 35 11 33.4M21 36.6l-9 1M27 35l10-1.6M27 36.6l9 1"/>',
    bird: '<path class="fur" d="M11 30c0-11 6-19 14-19 7 0 12 6 12 14 0 9-6 16-14 16-7 0-12-4.6-12-11Z"/>'
      + '<path class="fur2" d="M17 33c2-4 8-5 12-2 2 1.6 2 5 0 7-3 2.4-9 2.4-12-.4-1-1.2-1-3.2 0-4.6Z"/>'
      + '<path class="beak" d="M36 21.4 44 24.4 36 27Z"/><path class="beak2" d="M36 24.4h8L36 27Z"/>'
      + '<g class="eyes"><circle class="eye" cx="30" cy="21" r="2.6"/><circle class="pupil" cx="30" cy="21.2" r="1.1"/><circle class="glint" cx="30.8" cy="20.2" r=".8"/></g>'
      + '<path class="wing" d="M14 28c4-2 10-1 13 3-4 3.4-10 3.6-14 1Z"/><path class="crest" d="M22 11.4c-1-3 1-6 4-6.4-1 1.6-.6 3.4.6 5"/>',
    owl: '<path class="tuft" d="M12 12 9 4l7 6M36 12l3-8-7 6"/>'
      + '<path class="fur" d="M10 24c0-8 6-13 14-13s14 5 14 13v6c0 7-6 12-14 12s-14-5-14-12Z"/>' + '@УЗОР@'
      + '<path class="fur2" d="M11 23c0-4 3-7 7-7 3 0 5 2 6 4 1-2 3-4 6-4 4 0 7 3 7 7 0 4-3 7-7 7-3 0-5-2-6-4-1 2-3 4-6 4-4 0-7-3-7-7Z"/>'
      + ГЛАЗА(18, 30, 23, 3.2) + '<path class="beak" d="M22.4 27h3.2L24 32Z"/>'
      + '<path class="line" d="M15 36q2 1 4 0M21 37.4q3 1 6 0M29 36q2 1 4 0"/>',
    bat: '<path class="wing2" d="M22 26C16 18 8 16 2 20c3 1 4 3 4 6 2-1.4 4-1.4 5 0 1.4-1.6 3.4-1.6 5 0 1.6-1.4 4-1.4 6 0Z M26 26c6-8 14-10 20-6-3 1-4 3-4 6-2-1.4-4-1.4-5 0-1.4-1.6-3.4-1.6-5 0-1.6-1.4-4-1.4-6 0Z"/>'
      + '<path class="ear" d="M17 17 15 7l6 6Z M31 17l2-10-6 6Z"/><path class="inner" d="M16.6 15 15.6 9.6 19 13Z M31.4 15l1-5.4L29 13Z"/>'
      + '<path class="fur" d="M15 25c0-6 4-10 9-10s9 4 9 10c0 6-4 10-9 10s-9-4-9-10Z"/>' + ГЛАЗА(20.4, 27.6, 23.4, 1.8)
      + '<path class="nose" d="M22.8 27h2.4L24 28.4Z"/><path class="fang" d="M21.6 30.4l.8 1.8.8-1.8Z M24.8 30.4l.8 1.8.8-1.8Z"/>',
    // Змея: кольца внизу, шея поднимается к голове — оба глаза на голове.
    snake: '<ellipse class="fur" cx="24" cy="39" rx="17" ry="6.4"/><ellipse class="coil" cx="24" cy="37.6" rx="11.6" ry="3.8"/><ellipse class="fur" cx="24" cy="35.8" rx="11" ry="4.2"/>'
      + '<path class="scale" d="M10 40q3-2 6 0M18.4 41.6q3-2 6 0M27 41.6q3-2 6 0M33.6 39.6q2-1.6 4 0M17 35.4q3-1.6 6 0M27 35.4q3-1.6 6 0"/>'
      + '<path class="neck" d="M19.4 35c-2.4-6 1.6-10 5.6-13 3-2.4 3.2-5 2-7.4"/><path class="belly" d="M19.4 35c-2.4-6 1.6-10 5.6-13"/>'
      + '<ellipse class="fur" cx="26" cy="12.4" rx="8.6" ry="6.2"/><path class="fur2" d="M20 15.4c2.4 2 9.6 2 12 0"/>'
      + '<g class="eyes"><ellipse class="eye" cx="22.2" cy="11.2" rx="2.1" ry="1.9"/><ellipse class="eye r" cx="29.8" cy="11.2" rx="2.1" ry="1.9"/><path class="slit" d="M22.2 9.8v2.8M29.8 9.8v2.8"/><circle class="glint" cx="22.9" cy="10.4" r=".5"/><circle class="glint" cx="30.5" cy="10.4" r=".5"/></g>'
      + '<path class="nostril" d="M24.8 15.6h.01M27.2 15.6h.01"/><path class="tongue" d="M26 18.4v3.4M26 21.8l-1.6 1.8M26 21.8l1.6 1.8" fill="none"/>',
    robot: '<path class="antenna" d="M24 9V4"/><circle class="led" cx="24" cy="3.4" r="1.8"/>'
      + '<rect class="fur" x="9" y="9" width="30" height="27" rx="8"/><rect class="visor" x="13" y="15" width="22" height="11" rx="5.5"/>'
      + '<g class="eyes"><rect class="eye bot" x="17" y="18.4" width="4" height="4.2" rx="1.6"/><rect class="eye bot r" x="27" y="18.4" width="4" height="4.2" rx="1.6"/></g>'
      + '<path class="line" d="M19 31h10M21 33.4h6"/><circle class="bolt" cx="12.4" cy="12.4" r=".9"/><circle class="bolt" cx="35.6" cy="12.4" r=".9"/>'
      + '<path class="fur2" d="M18 36h12v4.6H18Z"/><path class="ear" d="M5.6 18h3.4v8H5.6Z M39 18h3.4v8H39Z"/>',
    dragon: '<path class="horn" d="M15 13 9 3l9 8Z M33 13l6-10-9 8Z"/>'
      + '<path class="fur" d="M11 24c0-9 6-13 13-13s13 4 13 13c0 3-1 5-2 7l3 6c-4 3-9 4.6-14 4.6S14 40 10 37l3-6c-1-2-2-4-2-7Z"/>'
      + '<path class="fur2" d="M17 33c3-2 11-2 14 0 0 3-3 6-7 6s-7-3-7-6Z"/>'
      + '<g class="eyes"><ellipse class="eye gold" cx="18.4" cy="23" rx="2.6" ry="2.2"/><ellipse class="eye gold r" cx="29.6" cy="23" rx="2.6" ry="2.2"/><path class="slit" d="M18.4 21v4M29.6 21v4"/></g>'
      + '<path class="line" d="M21.6 33.2h.01M26.4 33.2h.01 M15 17c2-1 4-1 5 0M33 17c-2-1-4-1-5 0"/><path class="scale" d="M20 14.6q4-2 8 0M18 18q6-2.6 12 0"/>',
    spirit: '<path class="glow" d="M24 4c6 7 14 11 14 22 0 9-6.4 15-14 15S10 35 10 26C10 15 18 11 24 4Z"/>'
      + '<path class="fur" d="M24 7c5 6.4 12 10 12 19.6 0 7.6-5.4 12.6-12 12.6s-12-5-12-12.6C12 17 19 13.4 24 7Z"/>'
      + '<path class="fur2" d="M24 16c3 4 6 6.4 6 11.4 0 4-2.6 6.6-6 6.6s-6-2.6-6-6.6C18 22.4 21 20 24 16Z"/>' + ГЛАЗА(20.4, 27.6, 26, 2) + '<path class="line" d="M22 31c1 .8 3 .8 4 0"/>'
      + '<circle class="spark" cx="39" cy="12" r="1.2"/><circle class="spark" cx="9" cy="17" r=".9"/>',
    blob: '<path class="fur" d="M8 32c0-11 7-20 16-20s16 9 16 20c0 6-6 9-16 9S8 38 8 32Z"/><path class="fur2" d="M14 24c2-5 6-7 10-7"/>'
      + ГЛАЗА(19, 29, 28, 2.4) + '<path class="line" d="M22 34c1.2 1 2.8 1 4 0"/><path class="blush" d="M14 32.4h3M31 32.4h3"/>',
  };
  const рисунок = (П[род] || П.blob).replace('@УЗОР@', узор && УЗОР[узор] ? УЗОР[узор] : '');
  return `<svg class="hud-pet2-face" viewBox="0 0 48 48" aria-hidden="true">${рисунок}${род === 'cat' || род === 'dog' ? ОШЕЙНИК : ''}</svg>`;
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
    + `<div class="hud-pet2-top"><div class="hud-pet2-ava">${портретСпутника(род, p.species, узор)}</div>`
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
