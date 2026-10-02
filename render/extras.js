// hud-manager/render/extras.js
//
// Новые блоки карточки: фаза луны в сцене, титры в конце, состояние тела,
// поворот сюжета, спутник карточкой и тамагочи. Всё здесь — чистые функции
// «данные → разметка»; оформление живёт в css/extras.css.

import { escapeHtml, hudHasMeaningfulValue } from '../utils.js?v=23.31.0';
import { settings } from '../settings.js?v=23.31.0';

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
  { к: 'energy', rx: /энерг|^eng/i, имя: 'Энергия', c: '#f2c14e' },
  { к: 'awake', rx: /бодр|сонлив|^awk/i, имя: 'Бодрость', c: '#6fb7ff' },
  { к: 'food', rx: /сыт|голод|^sat/i, имя: 'Сытость', c: '#f08a4b' },
  { к: 'stress', rx: /стресс|напряж|^str/i, имя: 'Стресс', c: '#ef5a6e' },
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
    else if (/^дел|^dut|работ|учёб|учеб/i.test(метка)) текст.дела = тело;
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
export function разобратьПоворот(value) {
  const о = { название: '', что: '', куда: '', тон: '' };
  String(value || '').split(/;|\n/).map(s => s.trim()).filter(Boolean).forEach(часть => {
    const m = часть.match(/^([^:]{1,20}):\s*(.+)$/);
    const метка = m ? m[1].trim().toLowerCase() : '', тело = m ? m[2].trim() : часть;
    if (/назв|^ttl|title/.test(метка)) о.название = тело;
    else if (/случ|^hap|what/.test(метка)) о.что = тело;
    else if (/куда|вед|^hnt|hint|lead/.test(метка)) о.куда = тело;
    else if (/тон|^ton|tone/.test(метка)) о.тон = тело.toLowerCase();
    else о.что = о.что ? о.что + '; ' + часть : часть;
  });
  if (!о.название && о.что) { о.название = о.что; о.что = ''; }
  return о;
}
export function карточкаПоворота(value) {
  if (!есть(value)) return '';
  const п = разобратьПоворот(value);
  if (!п.название) return '';
  const тон = /bad|плох|угроз|опас|тревож/.test(п.тон) ? 'bad' : /good|хорош|удач|свет/.test(п.тон) ? 'good' : 'neutral';
  const знак = тон === 'bad' ? МОЛНИЯ : тон === 'good' ? ПИСЬМО : ВОПРОС;
  return `<div class="hud-twist is-${тон}"><span class="hud-twist-rib">ПОВОРОТ</span><h5>${знак}${escapeHtml(п.название)}</h5>`
    + (п.что ? `<p>${escapeHtml(п.что)}</p>` : '') + (п.куда ? `<span class="hud-twist-hint">Куда может повести: ${escapeHtml(п.куда)}</span>` : '') + `</div>`;
}

// ---------------------------------------------------------------------------
// СПУТНИК: карточка и тамагочи
// ---------------------------------------------------------------------------
const И = {
  cond: 'M3 12h4l2-5 4 10 2-5h6', food: 'M5 13h14a7 7 0 0 1-14 0Z M8 9c0-2 2-2 2-4M12 9c0-2 2-2 2-4', note: 'M12 7v5l3 2 M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0',
  bolt: 'M13 3 5 13.5h6L10 21l8-10.5h-6Z', drop: 'M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5Z', smile: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M8 15c1.5-1.5 6.5-1.5 8 0 M9 9.5h.01 M15 9.5h.01',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z', plug: 'M9 3v5M15 3v5M7 8h10v4a5 5 0 0 1-10 0Z M12 17v4', gear: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
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
  { к: 'food', rx: /сыт|^sat|голод|еда/i, имя: 'Сытость', ик: 'food', c: '#f08a4b' },
  { к: 'energy', rx: /энерг|^eng|сил/i, имя: 'Энергия', ик: 'bolt', c: '#f2c14e' },
  { к: 'clean', rx: /чист|^cln/i, имя: 'Чистота', ик: 'drop', c: '#6fb7ff' },
  { к: 'charge', rx: /заряд|^chg|батар/i, имя: 'Заряд', ик: 'plug', c: '#6fd39a' },
  { к: 'fix', rx: /исправ|^fix|поломк/i, имя: 'Исправность', ик: 'gear', c: '#8fb8ff' },
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
    if (к === 'food') return /голод|не ел|не корм|требует/.test(слова) ? 1 : /сыт|покорм|поел/.test(слова) ? 4 : 3;
    if (к === 'energy') return /устал|спит|вял|измот/.test(слова) ? 2 : /бодр|носится|игрив|энерг/.test(слова) ? 5 : 3;
    if (к === 'clean') return /гряз|мокр|в грязи/.test(слова) ? 2 : /вылиз|чист/.test(слова) ? 5 : 4;
    if (к === 'charge') { const m = слова.match(/(\d{1,3})\s*%/); return m ? огр(Math.round(+m[1] / 20), 0, 5) : /разряж|сел/.test(слова) ? 1 : 3; }
    if (к === 'fix') return /слом|поврежд|сбой|застрял/.test(слова) ? 2 : 4;
    if (к === 'mood') return /обиж|зл|рыч|груст|скуч|испуг/.test(слова) ? 1 : /рад|доволь|мурч|счаст|игрив/.test(слова) ? 5 : 3;
    return 3;
  };
  const набор = механизм ? ['charge', 'fix', 'mood'] : ['food', 'energy', 'clean', 'mood'];
  return набор.map(к => ({ ...ПОТРЕБНОСТИ.find(x => x.к === к), n: уровни[к] ?? угадать(к) }));
}
const инициалы = (имя) => String(имя || '?').trim().split(/\s+/).slice(0, 2).map(ч => ч.charAt(0).toUpperCase()).join('') || '?';
export function карточкаСпутника(p, значок, связь, связьHTML = '') {
  const тип = СПРАЙТЫ[видСпутника(p.species, p.name)];
  const цвет = тип.цвет;
  const плитка = (к, подпись, текст) => есть(текст) ? `<div class="hud-pet2-tile"><span>${ик(к, цвет)}${подпись}</span><p>${escapeHtml(String(текст))}</p></div>` : '';
  const плитки = плитка('cond', 'Состояние', p.condition) + плитка('food', 'Рацион', p.diet) + плитка('smile', 'Настроение', p.mood);
  const умения = есть(p.skills) ? String(p.skills).split(/[;\n]/).map(s => s.trim()).filter(Boolean) : [];
  return `<div class="hud-pet2" style="--p:${цвет}"><div class="hud-pet2-band"></div><div class="hud-pet2-top"><div class="hud-pet2-ava" aria-hidden="true">${значок}</div>`
    + `<div class="hud-pet2-nm"><b>${escapeHtml(p.name)}</b>${есть(p.species) ? `<small>${escapeHtml(p.species)}</small>` : ''}</div>${есть(p.mood) ? `<span class="hud-pet2-mood">${escapeHtml(p.mood)}</span>` : ''}</div>`
    + (есть(p.owner) ? `<div class="hud-pet2-own"><i>${escapeHtml(инициалы(p.owner))}</i>хозяин: <b>${escapeHtml(p.owner)}</b></div>` : '')
    + (связьHTML ? `<div class="hud-pet2-bondrow">${связьHTML}</div>` : '')
    + (плитки ? `<div class="hud-pet2-tiles">${плитки}</div>` : '')
    + (есть(p.note) ? `<div class="hud-pet2-now">${ик('note', цвет)}<span>Сейчас: ${escapeHtml(String(p.note))}</span></div>` : '')
    + (Array.isArray(p.extra) && p.extra.length ? `<div class="hud-pet2-extra">${p.extra.map(д => `<span><b>${escapeHtml(д.key)}:</b> ${escapeHtml(String(д.value))}</span>`).join('')}</div>` : '')
    + (умения.length ? `<div class="hud-pet2-skills">${умения.map(у => `<span>${escapeHtml(у)}</span>`).join('')}</div>` : '<div class="hud-pet2-pad"></div>') + `</div>`;
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
  const умения = есть(p.skills) ? String(p.skills).split(/[;\n]/).map(s => s.trim()).filter(Boolean) : [];
  const сведения = строка('Хозяин', p.owner) + строка('Состояние', p.condition) + строка('Рацион', p.diet)
    + (есть(p.note) ? строка('Настроение', p.mood) : '')
    + (Array.isArray(p.extra) ? p.extra.map(д => строка(escapeHtml(д.key), д.value)).join('') : '');
  const низ = (сведения || умения.length) ? `<div class="hud-tama-info">${сведения}${умения.length ? `<div class="hud-tama-skills">${умения.map(у => `<i>${escapeHtml(у)}</i>`).join('')}</div>` : ''}</div>` : '';
  return `<div class="hud-tama" style="--p:${тип.цвет}">${dev}<div class="hud-tama-stats"><b>${escapeHtml(p.name)}</b>${есть(p.species) ? `<small>${escapeHtml(p.species)}</small>` : ''}`
    + статы.map(s => `<div class="hud-tama-st" style="--c:${s.c}">${ик(s.ик, s.c)}<span>${s.имя}</span><span class="hud-tama-px">${Array.from({ length: 5 }, (_, i) => `<i${i < s.n ? '' : ' class="off"'}></i>`).join('')}</span></div>`).join('')
    + (связьHTML || '') + (реплика ? `<div class="hud-tama-say">${escapeHtml(реплика)}</div>` : '') + `</div>${низ}</div>`;
}
