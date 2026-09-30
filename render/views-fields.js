// hud-manager/render/views-fields.js
//
// Виды простых полей карточки (Кастомизация → Вид блоков): возраст, одежда,
// внешность, роль, тело, физиология, место, статус, ключ, ожидание и
// реальность, цели, расписание, флаг-монитор, глубина конфликта, реплики.
// Первый вид у каждого поля — «как было» и рисуется прежним кодом
// (render/character.js); здесь только новые. Данные те же — модель ничего
// нового не пишет. Не разобрали данные — пустая строка, и поле рисуется
// по-старому. Оформление — css/views-fields.css.

import { escapeHtml, разбитьСписок } from '../utils.js?v=23.24.0';
import { ико } from './view-icons.js?v=23.24.0';

const т = (s) => escapeHtml(String(s ?? '').trim());
const пусто = (v) => !String(v ?? '').trim() || /^(empty|none|null|нет|пусто|—|-)$/i.test(String(v).trim());
const огр = (v, a, b) => Math.max(a, Math.min(b, v));
let счёт = 0;
const новыйId = (п) => `hud-f-${п}-${(++счёт).toString(36)}`;
const с1 = (s) => { const x = String(s || '').trim(); return x.charAt(0).toUpperCase() + x.slice(1); };

// Пункты списка: сначала «;», а если он один — запятые (не внутри скобок).
function куски(value) {
  const s = String(value ?? '').trim();
  let ч = разбитьСписок(s).map(x => x.trim()).filter(Boolean);
  if (ч.length < 2) ч = s.split(/,\s*(?![^()]*\))/).map(x => x.trim()).filter(Boolean);
  return ч.filter(x => !пусто(x)).map(x => x.replace(/[.;]+$/, ''));
}
// «xp: …; gt: …» → { xp: '…', gt: '…' }.
function метки(value) {
  const о = {};
  for (const к of разбитьСписок(value)) {
    const m = String(к).match(/^\s*([a-zа-яё][a-zа-яё\s-]{0,18}?)\s*[:：]\s*(.+)$/i);
    if (m) о[m[1].trim().toLowerCase()] = m[2].trim();
  }
  return о;
}
const взять = (о, ...ключи) => { for (const к of ключи) if (о[к] && !пусто(о[к])) return о[к]; return ''; };
const обёртка = (поле, вид, тело, доп = '') => `<div class="hud-v hud-f hud-f-${поле} is-${вид}${доп}">${тело}</div>`;
// Ведущий эмодзи пункта («🔥 Сердце колотится…») — отдельно от текста.
function сЭмодзи(s) {
  const m = String(s).match(/^\s*(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*)\s*/u);
  return m ? { значок: m[1], текст: String(s).slice(m[0].length).trim() } : { значок: '', текст: String(s).trim() };
}

/* --- Возраст --------------------------------------------------------------- */

const годы = (n) => { const a = n % 100, b = n % 10; return a > 10 && a < 20 ? 'лет' : b === 1 ? 'год' : b >= 2 && b <= 4 ? 'года' : 'лет'; };
const ЗНАКИ = [
  [1, 20, 'Козерог', '♑', 'земля'], [2, 19, 'Водолей', '♒', 'воздух'], [3, 21, 'Рыбы', '♓', 'вода'], [4, 20, 'Овен', '♈', 'огонь'],
  [5, 21, 'Телец', '♉', 'земля'], [6, 21, 'Близнецы', '♊', 'воздух'], [7, 23, 'Рак', '♋', 'вода'], [8, 23, 'Лев', '♌', 'огонь'],
  [9, 23, 'Дева', '♍', 'земля'], [10, 23, 'Весы', '♎', 'воздух'], [11, 22, 'Скорпион', '♏', 'вода'], [12, 22, 'Стрелец', '♐', 'огонь'],
];
function знакЗодиака(д, м) {
  // Граница — день, с которого начинается следующий знак.
  const [, граница, ...этот] = ЗНАКИ[м - 1];
  if (д < граница) return этот;
  return ЗНАКИ[м % 12].slice(2);
}
function видВозраста(value, вид) {
  const s = String(value).trim();
  const m = s.match(/^\s*(\d{1,3})(?!\d)/);
  if (!m) return '';
  const n = +m[1];
  const хвост = s.slice(m[0].length).replace(/^\s*(?:лет|года?|y\.?o\.?)?\s*[,;—–-]?\s*/i, '').trim();
  const д = хвост.match(/(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?/);
  if (вид === 'id') {
    return обёртка('age', 'id', `<span class="hud-f-id-photo" aria-hidden="true">${ико('head')}</span>`
      + `<span class="hud-f-id-rows"><small>Возраст</small><b>${n} ${годы(n)}</b>${хвост ? `<small>${д ? 'Дата рождения' : 'Примечание'}</small><b>${т(хвост)}</b>` : ''}</span>`
      + `<i class="hud-f-id-chip" aria-hidden="true"></i>`);
  }
  if (вид === 'zodiac') {
    if (!д) return '';
    const [имя, знак, стихия] = знакЗодиака(+д[1], огр(+д[2], 1, 12));
    return обёртка('age', 'zodiac', `<span class="hud-f-sign" aria-hidden="true">${знак}︎</span>`
      + `<span class="hud-f-zod-text"><b>${n}<small> ${годы(n)}</small></b><em>${имя} · ${стихия}</em><small>${т(хвост)}</small></span>`, ` el-${{ огонь: 'fire', земля: 'earth', воздух: 'air', вода: 'water' }[стихия]}`);
  }
  if (вид === 'rings') {
    // Годовые кольца: одно кольцо на пять лет, чуть неровные, как у спила.
    const колец = огр(Math.ceil(n / 5), 2, 14);
    const кольца = Array.from({ length: колец }, (_, i) => {
      const r = 6 + (i + 1) * (22 / колец);
      return `<ellipse cx="${(32 + (i % 2 ? .6 : -.4)).toFixed(1)}" cy="32" rx="${r.toFixed(1)}" ry="${(r * (.93 + (i % 3) * .025)).toFixed(1)}" style="--i:${i}"/>`;
    }).join('');
    return обёртка('age', 'rings', `<svg class="hud-f-rings" viewBox="0 0 64 64" aria-hidden="true"><circle class="bark" cx="32" cy="32" r="30"/><g class="rings">${кольца}</g><path class="crack" d="M32 32 45 14"/></svg>`
      + `<span class="hud-f-rings-text"><b>${n}</b><small>${годы(n)}</small>${хвост ? `<em>${т(хвост)}</em>` : ''}</span>`);
  }
  return '';
}

/* --- Одежда ---------------------------------------------------------------- */

function видОдежды(value, вид) {
  const в = куски(value);
  if (!в.length) return '';
  if (вид === 'hanger') {
    return обёртка('clothes', 'hanger', `<i class="hud-f-rail" aria-hidden="true"></i><div class="hud-f-hang">${в.map((x, i) => `<span style="--i:${i}"><i class="hook" aria-hidden="true"></i>${т(x)}</span>`).join('')}</div>`);
  }
  if (вид === 'layers') {
    return обёртка('clothes', 'layers', `<ol>${в.map((x, i) => `<li style="--i:${i}"><i aria-hidden="true">${i + 1}</i><span>${т(x)}</span></li>`).join('')}</ol>`);
  }
  if (вид === 'tags') {
    return обёртка('clothes', 'tags', в.map((x, i) => `<span class="hud-f-tag" style="--r:${((i % 3) - 1) * 1.4}deg"><i class="hole" aria-hidden="true"></i>${т(x)}</span>`).join(''));
  }
  return '';
}

/* --- Внешность ------------------------------------------------------------- */

const ПРИМЕТЫ = [
  ['Рост', /\d{2,3}\s*см|\bрост|высок|невысок|низк|миниатюр/i, 'leg'],
  ['Сложение', /строй|худ|полн|плотн|широк|хрупк|спортив|мускул|сложен|фигур|изящн|крепк/i, 'torso'],
  ['Волосы', /волос|стриж|кос[аы]\b|локон|кудр|блонд|брюнет|рыж|шатен|лыс|чёлк|челк/i, 'head'],
  ['Глаза', /глаз|взгляд|ресниц/i, 'eye'],
  ['Кожа', /кож[аеи]|загар|веснуш|бледн|смугл/i, 'drop'],
  ['Приметы', /шрам|родинк|татуир|тату|пирсинг|ожог|веснушк|щетин|бород|\bус[ыа]?\b|очки/i, 'star'],
  ['Лицо', /лиц|губ|скул|нос\b|брови|улыб/i, 'mask'],
];
const примета = (x) => ПРИМЕТЫ.find(([, rx]) => rx.test(x)) || ['Облик', null, 'diamond'];
function видВнешности(value, вид) {
  const в = куски(value);
  if (!в.length) return '';
  if (вид === 'traits') {
    return обёртка('looks', 'traits', в.map(x => `<span class="hud-f-chip">${ико(примета(x)[2])}${т(x)}</span>`).join(''));
  }
  if (вид === 'profile') {
    const строки = new Map();
    for (const x of в) { const [имя] = примета(x); if (!строки.has(имя)) строки.set(имя, []); строки.get(имя).push(x); }
    return обёртка('looks', 'profile', `<dl>${[...строки].map(([имя, что]) => `<div><dt>${ико(примета(что[0])[2])}${имя}</dt><dd>${что.map(т).join(', ')}</dd></div>`).join('')}</dl>`);
  }
  if (вид === 'sketch') {
    return обёртка('looks', 'sketch', `<span class="hud-f-pencil" aria-hidden="true">${ико('tool')}</span><p>${в.map(x => `<span>${т(x)}</span>`).join('<i aria-hidden="true"> · </i>')}</p>`);
  }
  return '';
}

/* --- Роль ------------------------------------------------------------------ */

function видРоли(value, вид) {
  const [главное, ...ещё] = куски(value);
  if (!главное) return '';
  if (вид === 'badge') {
    return обёртка('role', 'badge', `<i class="hud-f-clip" aria-hidden="true"></i><span class="hud-f-badge-top" aria-hidden="true">ПРОПУСК</span>`
      + `<b>${т(с1(главное))}</b>${ещё.map(x => `<small>${т(x)}</small>`).join('')}<i class="hud-f-barcode" aria-hidden="true"></i>`);
  }
  if (вид === 'ribbon') {
    return обёртка('role', 'ribbon', `<b class="hud-f-ribbon"><span>${т(с1(главное))}</span></b>${ещё.length ? `<span class="hud-f-under">${ещё.map(x => `<span>${т(x)}</span>`).join('')}</span>` : ''}`);
  }
  if (вид === 'stack') {
    return обёртка('role', 'stack', `<b>${т(с1(главное))}</b><i class="hud-f-rule" aria-hidden="true"></i>${ещё.length ? `<small>${ещё.map(т).join(' · ')}</small>` : ''}`);
  }
  return '';
}

/* --- Тело: новый вид текста -------------------------------------------------- */

const СИЛУЭТ = 'M12 2.6a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Z M8.4 9.4h7.2l1.6 6.2-1.8.4-1.2-4v11.4h-2V17h-.4v6.4h-2V12l-1.2 4-1.8-.4Z';
// Тело: силуэт и ощущения столбиком по «позвоночнику».
export function видТела(value) {
  const в = куски(value);
  if (!в.length) return '';
  return `<div class="hud-v hud-f hud-f-body"><svg class="hud-f-fig" viewBox="0 0 24 26" aria-hidden="true"><path d="${СИЛУЭТ}"/></svg>`
    + `<ul>${в.map((x, i) => `<li style="--i:${i}">${т(с1(x))}</li>`).join('')}</ul></div>`;
}

/* --- Физиология ------------------------------------------------------------ */

const ОЩУЩЕНИЯ = [
  [/жар|горяч|пыла|знобит|озноб|температур/i, 'flame'], [/пить|рот|жажд|пересох|слюн|губ/i, 'drop'],
  [/возбужд|желан|влеч|томлен|страст/i, 'heart'], [/хмел|вин|пьян|алкогол|коньяк|пив/i, 'cup'],
  [/боль|ноет|ныть|тян|спазм|колет|ломит/i, 'bolt'], [/устал|сонн|сон\b|вял|изнем|разбит/i, 'moon'],
  [/дрож|трясёт|трясет|мурашк|дыхан|задыха/i, 'wave'], [/сердц|пульс|колотит/i, 'hearts'], [/голод|сыт|тошн|живот/i, 'box'],
];
const силаОщущения = (x) => /сильн|очень|пылает|остр|невыносим|жутк|бешен|на пределе/i.test(x) ? 3 : /лёгк|легк|слегка|немного|чуть|едва|слаб/i.test(x) ? 1 : 2;
function видФизиологии(value, вид) {
  const в = куски(value);
  if (!в.length) return '';
  const ико2 = (x) => ико((ОЩУЩЕНИЯ.find(([rx]) => rx.test(x)) || [0, 'star'])[1]);
  if (вид === 'sensors') {
    return обёртка('phys', 'sensors', в.map(x => `<span class="hud-f-sensor s${силаОщущения(x)}"><i aria-hidden="true">${ико2(x)}</i><span>${т(с1(x))}</span><b aria-hidden="true">${'<s></s>'.repeat(3)}</b></span>`).join(''));
  }
  if (вид === 'bubbles') {
    return обёртка('phys', 'bubbles', в.map((x, i) => `<span class="hud-f-bubble s${силаОщущения(x)}" style="--i:${i}">${ико2(x)}<span>${т(x)}</span></span>`).join(''));
  }
  if (вид === 'readout') {
    return обёртка('phys', 'readout', `<span class="hud-f-screen-top" aria-hidden="true"><i></i><i></i><i></i><b>SENSORS</b></span>`
      + в.map(x => `<code class="s${силаОщущения(x)}"><i aria-hidden="true">▸</i>${т(x)}<b aria-hidden="true">${['LOW', 'MID', 'HIGH'][силаОщущения(x) - 1]}</b></code>`).join(''));
  }
  return '';
}

/* --- Место ----------------------------------------------------------------- */

function видМеста(value, вид) {
  const в = куски(value);
  if (!в.length) return '';
  if (вид === 'crumbs') {
    return обёртка('place', 'crumbs', в.map((x, i) => `<span class="${i === в.length - 1 ? 'is-here' : ''}">${i === в.length - 1 ? ико('target') : ''}${т(x)}</span>`).join('<i class="sep" aria-hidden="true">›</i>'));
  }
  if (вид === 'pin') {
    const [где, ...ещё] = в;
    return обёртка('place', 'pin', `<span class="hud-f-map" aria-hidden="true"><i class="road r1"></i><i class="road r2"></i><i class="road r3"></i><svg class="pin" viewBox="0 0 24 30"><path d="M12 29s-9-9.4-9-16a9 9 0 0 1 18 0c0 6.6-9 16-9 16Z"/><circle cx="12" cy="12.6" r="3.4"/></svg><i class="ping"></i></span>`
      + `<span class="hud-f-pin-text"><b>${т(с1(где))}</b>${ещё.length ? `<small>${ещё.map(т).join(' · ')}</small>` : ''}</span>`);
  }
  if (вид === 'sign') {
    const [где, ...ещё] = в;
    return обёртка('place', 'sign', `<span class="hud-f-sign-plate"><i class="bolt b1" aria-hidden="true"></i><i class="bolt b2" aria-hidden="true"></i><b>${т(с1(где))}</b></span>`
      + (ещё.length ? `<span class="hud-f-arrows">${ещё.map(x => `<span>${т(x)}</span>`).join('')}</span>` : ''));
  }
  return '';
}

/* --- Статус ---------------------------------------------------------------- */

function видСтатуса(value, вид) {
  const [главное, ...ещё] = куски(value);
  if (!главное) return '';
  if (вид === 'badge') {
    return обёртка('status', 'badge', `<span class="hud-f-presence"><i class="dot" aria-hidden="true"></i><b>${т(с1(главное))}</b></span>${ещё.length ? `<span class="hud-f-sub">${ещё.map(x => `<span>${т(x)}</span>`).join('')}</span>` : ''}`);
  }
  if (вид === 'stamp') {
    return обёртка('status', 'stamp', `<span class="hud-f-stamp"><b>${т(главное)}</b>${ещё.length ? `<small>${ещё.map(т).join(' · ')}</small>` : ''}</span>`);
  }
  if (вид === 'toggles') {
    return обёртка('status', 'toggles', [главное, ...ещё].map(x => `<span class="hud-f-toggle"><i aria-hidden="true"></i>${т(с1(x))}</span>`).join(''));
  }
  return '';
}

/* --- Ключ ------------------------------------------------------------------ */

function видКлюча(value, вид) {
  const п = String(value || '').split(';').map(x => x.trim()).filter(x => x && !пусто(x)).map(сЭмодзи);
  if (!п.length) return '';
  if (вид === 'stickers') {
    return обёртка('key', 'stickers', п.map((x, i) => `<span class="hud-f-sticker" style="--r:${[-1.6, 1.2, -.6, 1.8][i % 4]}deg;--i:${i}">${x.значок ? `<i class="em">${x.значок}</i>` : ''}<span>${т(x.текст)}</span></span>`).join(''));
  }
  if (вид === 'bullets') {
    return обёртка('key', 'bullets', `<ol>${п.map((x, i) => `<li style="--i:${i}"><i class="bead" aria-hidden="true">${x.значок || i + 1}</i><span>${т(x.текст)}</span></li>`).join('')}</ol>`);
  }
  if (вид === 'headlines') {
    const [первый, ...ещё] = п;
    return обёртка('key', 'headlines', `<span class="hud-f-mast" aria-hidden="true"><i></i>ГЛАВНОЕ<i></i></span><b class="lead">${первый.значок ? `<i>${первый.значок}</i>` : ''}${т(первый.текст)}</b>`
      + (ещё.length ? `<div class="cols">${ещё.map(x => `<p>${x.значок ? `<i>${x.значок}</i>` : ''}${т(x.текст)}</p>`).join('')}</div>` : ''));
  }
  return '';
}

/* --- Ожидание vs реальность ------------------------------------------------ */

function видОжидания(value, вид) {
  const о = метки(value);
  const ждал = взять(о, 'xp', 'ожидал', 'ожидание', 'ожидалось', 'expected');
  const вышло = взять(о, 'gt', 'вышло', 'реальность', 'получилось', 'reality');
  if (!ждал || !вышло) return '';
  if (вид === 'split') {
    return обёртка('exp', 'split', `<div class="half was"><small>Ожидал</small><p>${т(с1(ждал))}</p></div><i class="swap" aria-hidden="true">${ико('bolt')}</i><div class="half is"><small>Вышло</small><p>${т(с1(вышло))}</p></div>`);
  }
  if (вид === 'photos') {
    return обёртка('exp', 'photos', `<figure class="was"><span class="shot" aria-hidden="true">${ико('star')}</span><figcaption><small>как представлялось</small>${т(ждал)}</figcaption></figure>`
      + `<figure class="is"><span class="shot" aria-hidden="true">${ико('burst')}</span><figcaption><small>как вышло</small>${т(вышло)}</figcaption></figure>`);
  }
  if (вид === 'arrow') {
    return обёртка('exp', 'arrow', `<p class="was"><s>${т(с1(ждал))}</s></p><i class="turn" aria-hidden="true"><svg viewBox="0 0 40 24"><path d="M4 4c0 10 8 14 22 14"/><path d="M22 12l6 6-6 6"/></svg></i><p class="is">${т(с1(вышло))}</p>`);
  }
  return '';
}

/* --- Цели ------------------------------------------------------------------ */

function разобратьЦели(value) {
  const о = метки(value);
  const ц = [['Сейчас', взять(о, 'nw', 'сейчас', 'now')], ['Скоро', взять(о, 'sn', 'скоро', 'soon')], ['Когда-нибудь', взять(о, 'lt', 'будущее', 'потом', 'когда-нибудь', 'later', 'мечта')]].filter(([, x]) => x);
  if (ц.length) return ц;
  return куски(value).slice(0, 5).map((x, i) => [['Сейчас', 'Скоро', 'Потом', 'Позже', 'Мечта'][i], x]);
}
function видЦелей(value, вид) {
  const ц = разобратьЦели(value);
  if (!ц.length) return '';
  if (вид === 'ladder') {
    // Лестница вверх: внизу — то, что сейчас, наверху — дальняя цель.
    return обёртка('goals', 'ladder', ц.slice().reverse().map(([когда, что], i, все) => `<div class="step" style="--i:${все.length - 1 - i};--n:${все.length}"><small>${когда}</small><span>${т(с1(что))}</span>${i === все.length - 1 ? '<i class="you" aria-hidden="true">вы здесь</i>' : ''}</div>`).join(''));
  }
  if (вид === 'target') {
    const R = [26, 18, 10];
    return обёртка('goals', 'target', `<svg class="hud-f-target" viewBox="0 0 60 60" aria-hidden="true">${R.map((r, i) => `<circle class="r${i}" cx="30" cy="30" r="${r}"/>`).join('')}<circle class="bull" cx="30" cy="30" r="3.6"/><path class="arrow" d="M30 30 52 8M47 7l5 1 1 5M45 10.5l3.5 3.5"/></svg>`
      + `<ol>${ц.map(([когда, что], i) => `<li class="r${i}"><small>${когда}</small><span>${т(с1(что))}</span></li>`).join('')}</ol>`);
  }
  if (вид === 'road') {
    return обёртка('goals', 'road', `<i class="hud-f-roadline" aria-hidden="true"></i>${ц.map(([когда, что], i) => `<div class="stop" style="--i:${i}"><i class="flag" aria-hidden="true">${i === ц.length - 1 ? ико('star') : ''}</i><small>${когда}</small><span>${т(с1(что))}</span></div>`).join('')}`);
  }
  return '';
}

/* --- Расписание ------------------------------------------------------------ */

export function разобратьРасписание(value) {
  const v = String(value || '');
  return v.split(v.includes(';') ? /;/ : /(?:\.\s+(?=[А-ЯA-ZЁ])|\n)/).map(i => i.trim().replace(/\.$/, '')).filter(Boolean).map(text => {
    const m = text.match(/^(.{0,24}?\d{1,2}:\d{2})\s*[-—–:]?\s*(.+)$/) || text.match(/^([^-—–:;]{1,24}?)\s+[-—–]\s+(.+)$/);
    if (!m) return { когда: '', что: text, день: '', время: '' };
    const когда = m[1].trim(), время = (когда.match(/\d{1,2}:\d{2}/) || [''])[0];
    return { когда, что: m[2].trim(), время, день: когда.replace(время, '').trim() };
  });
}
function видРасписания(value, вид) {
  const с = разобратьРасписание(value);
  if (!с.length) return '';
  if (вид === 'calendar') {
    return обёртка('sched', 'calendar', с.map((x, i) => `<div class="page" style="--i:${i}"><span class="top">${т(x.день || 'в течение дня')}</span><b>${т(x.время || '—')}</b><span class="what">${т(с1(x.что))}</span><i class="rings" aria-hidden="true"><s></s><s></s></i></div>`).join(''));
  }
  if (вид === 'planner') {
    return обёртка('sched', 'planner', `<span class="hud-f-plan-head" aria-hidden="true">План</span>${с.map(x => `<div class="line"><span class="when">${т(x.когда || '·')}</span><span class="what">${т(с1(x.что))}</span><i class="box" aria-hidden="true"></i></div>`).join('')}`);
  }
  if (вид === 'tickets') {
    return обёртка('sched', 'tickets', с.map(x => `<div class="ticket"><span class="stub"><b>${т(x.время || '··:··')}</b><small>${т(x.день || 'сегодня')}</small></span><span class="what">${т(с1(x.что))}</span></div>`).join(''));
  }
  return '';
}

/* --- Флаг-монитор ---------------------------------------------------------- */

function видФлагов(value, вид) {
  const в = String(value || '').split(/;|\n/).map(x => x.trim()).filter(x => x && !пусто(x));
  if (!в.length) return '';
  if (вид === 'checklist') {
    return обёртка('flags', 'checklist', `<ul>${в.map(x => `<li><i class="box" aria-hidden="true"></i><span>${т(с1(x))}</span></li>`).join('')}</ul>`);
  }
  if (вид === 'pins') {
    return обёртка('flags', 'pins', в.map((x, i) => `<span class="note" style="--r:${[-2, 1.5, -1, 2.2, -1.6][i % 5]}deg"><i class="pin" aria-hidden="true"></i>${т(с1(x))}</span>`).join(''));
  }
  if (вид === 'lamps') {
    return обёртка('flags', 'lamps', в.map((x, i) => `<span class="lamp" style="--i:${i}"><i class="bulb" aria-hidden="true"></i><span>${т(с1(x))}</span></span>`).join(''));
  }
  return '';
}

/* --- Глубина конфликта ----------------------------------------------------- */

const СТАДИИ = [
  ['brewing', 'назревает', /brew|назрев/i], ['open', 'открытый', /^open|открыт/i],
  ['cold', 'холодная война', /cold|холодн/i], ['peace', 'примирение', /reconcil|примир/i],
];
function видКонфликта(value, вид) {
  const о = метки(value);
  const причина = взять(о, 'wy', 'причина', 'why');
  const дней = parseInt(взять(о, 'dys', 'дней', 'days'), 10);
  const сырое = взять(о, 'sg', 'стадия', 'stage');
  const ст = СТАДИИ.findIndex(([, , rx]) => rx.test(сырое));
  if (!причина && ст < 0) return '';
  const слово = ст >= 0 ? СТАДИИ[ст][1] : сырое;
  const днейТекст = Number.isFinite(дней) ? `${дней} ${дней % 10 === 1 && дней % 100 !== 11 ? 'день' : [2, 3, 4].includes(дней % 10) && ![12, 13, 14].includes(дней % 100) ? 'дня' : 'дней'}` : '';
  if (вид === 'stages') {
    return обёртка('conflict', 'stages', `<ol class="track">${СТАДИИ.map(([к, имя], i) => `<li class="st-${к}${i === ст ? ' is-now' : i < ст ? ' is-past' : ''}"><i aria-hidden="true"></i><span>${имя}</span></li>`).join('')}</ol>`
      + `<p>${причина ? т(с1(причина)) : ''}${днейТекст ? `<em>${днейТекст}</em>` : ''}</p>`);
  }
  if (вид === 'counter') {
    return обёртка('conflict', 'counter', `<span class="leaf"><i class="rings" aria-hidden="true"><s></s><s></s></i><b>${Number.isFinite(дней) ? дней : '?'}</b><small>${днейТекст ? днейТекст.replace(/^\d+\s*/, '') : 'дней'} в ссоре</small></span>`
      + `<span class="text">${слово ? `<em class="stage st-${ст >= 0 ? СТАДИИ[ст][0] : 'x'}">${т(слово)}</em>` : ''}${причина ? `<span>${т(с1(причина))}</span>` : ''}</span>`);
  }
  if (вид === 'weather') {
    // Погода между ними: назревает — туча, открытый — гроза, холодная
    // война — иней, примирение — солнце из-за тучи.
    const к = ст >= 0 ? СТАДИИ[ст][0] : 'brewing';
    const рисунок = {
      brewing: '<path class="cloud" d="M14 34h26a8 8 0 0 0 .6-16A11 11 0 0 0 19.6 20 7 7 0 0 0 14 34Z"/>',
      open: '<path class="cloud dark" d="M14 30h26a8 8 0 0 0 .6-16A11 11 0 0 0 19.6 16 7 7 0 0 0 14 30Z"/><path class="bolt" d="m28 29-6 9h5l-2.4 8 8.4-11h-5.6Z"/>',
      cold: '<path class="cloud cold" d="M14 30h26a8 8 0 0 0 .6-16A11 11 0 0 0 19.6 16 7 7 0 0 0 14 30Z"/><path class="snow" d="M20 37v6M17.4 38.5l5.2 3M22.6 38.5l-5.2 3M34 37v6M31.4 38.5l5.2 3M36.6 38.5l-5.2 3"/>',
      peace: '<circle class="sun" cx="34" cy="18" r="8"/><path class="rays" d="M34 5v3M44 8l-2 2M47 18h-3M24 8l2 2"/><path class="cloud" d="M10 38h24a7 7 0 0 0 .5-14A10 10 0 0 0 15.4 26 6 6 0 0 0 10 38Z"/>',
    }[к];
    return обёртка('conflict', 'weather', `<svg class="hud-f-sky st-${к}" viewBox="0 0 52 48" aria-hidden="true">${рисунок}</svg>`
      + `<span class="text">${слово ? `<b>${т(с1(слово))}</b>` : ''}${днейТекст ? `<small>${днейТекст}</small>` : ''}${причина ? `<span>${т(с1(причина))}</span>` : ''}</span>`, ` st-${к}`);
  }
  return '';
}

/* --- Реплики --------------------------------------------------------------- */

function видРеплик(value, вид, имя = '') {
  const в = String(value || '').split(/[;\n]/).map(x => x.trim().replace(/^[«"'`“„]+|[»"'`”]+$/g, '').trim()).filter(x => x && !пусто(x));
  if (!в.length) return '';
  if (вид === 'quotes') {
    return обёртка('lines', 'quotes', в.map((x, i) => `<blockquote style="--i:${i}"><i class="q" aria-hidden="true">“</i>${т(x)}</blockquote>`).join(''));
  }
  if (вид === 'script') {
    const кто = т(String(имя || '').trim().split(/\s+/)[0] || 'Персонаж').toUpperCase();
    return обёртка('lines', 'script', в.map(x => `<div class="cue"><b>${кто}</b><p>${т(x)}</p></div>`).join(''));
  }
  if (вид === 'subtitles') {
    return обёртка('lines', 'subtitles', `<i class="perf top" aria-hidden="true"></i>${в.map((x, i) => `<p style="--i:${i}"><span>${т(x)}</span></p>`).join('')}<i class="perf bottom" aria-hidden="true"></i>`);
  }
  return '';
}

/* --- Общий вход ------------------------------------------------------------ */

// Ключ настройки вида по названию поля (в нижнем регистре).
export const ВИД_ПОЛЯ = {
  'возраст': 'ageView', 'одежда': 'clothesView', 'внешность': 'looksView', 'роль': 'roleView',
  'физиология': 'physView', 'место': 'placeView', 'статус': 'statusView', 'ключ': 'keyView',
  'ожидание vs реальность': 'expView', 'цели': 'goalsView', 'расписание': 'scheduleView',
  'флаг-монитор': 'flagsView', 'глубина конфликта': 'conflictView', 'реплики': 'linesView',
};
const СБОРЩИКИ = {
  'возраст': видВозраста, 'одежда': видОдежды, 'внешность': видВнешности, 'роль': видРоли,
  'физиология': видФизиологии, 'место': видМеста, 'статус': видСтатуса, 'ключ': видКлюча,
  'ожидание vs реальность': видОжидания, 'цели': видЦелей, 'расписание': видРасписания,
  'флаг-монитор': видФлагов, 'глубина конфликта': видКонфликта, 'реплики': видРеплик,
};
// Поля, которым в новом виде нужна вся ширина карточки.
export const ШИРОКИЕ_ВИДЫ = new Set(['цели', 'расписание', 'реплики', 'флаг-монитор', 'ожидание vs реальность', 'ключ']);

/** Вид поля или '' — тогда поле рисуется по-старому. */
export function видПоля(ключ, value, вид, контекст = {}) {
  const сборщик = СБОРЩИКИ[ключ];
  if (!сборщик || !вид || вид === 'classic' || пусто(value)) return '';
  try { return сборщик(String(value), вид, контекст.имя || ''); } catch (e) { console.warn('[TavernOS HUD] вид поля', ключ, e); return ''; }
}
