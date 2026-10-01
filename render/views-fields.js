// hud-manager/render/views-fields.js
//
// Виды простых полей карточки (Кастомизация → Вид блоков): возраст, одежда,
// внешность, роль, тело, физиология, место, статус, ключ, ожидание и
// реальность, цели, расписание, флаг-монитор, глубина конфликта, реплики.
// Первый вид у каждого поля — «как было» и рисуется прежним кодом
// (render/character.js); здесь только новые. У каждого вида свой предмет —
// паспорт, срез дерева, бирки, скетчбук, орден, бокал, тепловизор,
// телеграммы, стрелочный перевод, мишень с дротиками, отрывной календарь,
// доска детектива, закладки, ключ с биркой, открытка, голосовые, неон,
// печать, перекидной счётчик… Данные те же — модель ничего нового не пишет.
// Не разобрали данные — пустая строка, и поле рисуется по-старому.
// Оформление — css/views-fields.css.

import { escapeHtml, разбитьСписок } from '../utils.js?v=23.28.1';
import { ико, ИКОНКИ } from './view-icons.js?v=23.28.1';

const т = (s) => escapeHtml(String(s ?? '').trim());
const пусто = (v) => !String(v ?? '').trim() || /^(empty|none|null|нет|пусто|—|-)$/i.test(String(v).trim());
const огр = (v, a, b) => Math.max(a, Math.min(b, v));
const ф = (n) => (Math.round(n * 10) / 10).toString();
let счёт = 0;
const новыйId = (п) => `hud-f-${п}-${(++счёт).toString(36)}`;
const с1 = (s) => { const x = String(s || '').trim(); return x.charAt(0).toUpperCase() + x.slice(1); };
// Детерминированный «случай» по строке: узор не прыгает от перерисовки.
function зерно(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function генератор(s) { let x = зерно(s) || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; }; }

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
// Всё, что не разобрали по известным меткам: чужие метки и куски без метки.
// Виды показывают это отдельной строкой — ни одно слово модели не пропадает.
function прочееМеток(value, известные) {
  return разбитьСписок(value).map(к => String(к).trim()).filter(к => к && !пусто(к)).filter(к => {
    const m = к.match(/^\s*([a-zа-яё][a-zа-яё\s-]{0,18}?)\s*[:：]\s*(.+)$/i);
    return !m || !известные.includes(m[1].trim().toLowerCase());
  });
}
const хвостик = (п) => п.length ? `<p class="hud-f-more">${п.map(т).join(' · ')}</p>` : '';
const взять = (о, ...ключи) => { for (const к of ключи) if (о[к] && !пусто(о[к])) return о[к]; return ''; };
const обёртка = (поле, вид, тело, доп = '', стиль = '') => `<div class="hud-v hud-f hud-f-${поле} is-${вид}${доп}"${стиль ? ` style="${стиль}"` : ''}>${тело}</div>`;
// Ведущий эмодзи пункта («🔥 Сердце колотится…») — отдельно от текста.
function сЭмодзи(s) {
  const m = String(s).match(/^\s*(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*)\s*/u);
  return m ? { значок: m[1], текст: String(s).slice(m[0].length).trim() } : { значок: '', текст: String(s).trim() };
}
const путь = (d, класс = '') => `<path${класс ? ` class="${класс}"` : ''} d="${d}"/>`;
const svgИко = (имя) => ИКОНКИ[имя] || ИКОНКИ.star;
// Силуэт по плечи: голова и плечи в поле 100×120.
const БЮСТ = 'M50 10c13 0 21 10 21 24 0 9-3 16-8 21l1 7c14 4 27 11 31 24 2 7 2 20 2 34H3c0-14 0-27 2-34 4-13 17-20 31-24l1-7c-5-5-8-12-8-21 0-14 8-24 21-24Z';

/* ============================== ВОЗРАСТ ================================== */

const годы = (n) => { const a = n % 100, b = n % 10; return a > 10 && a < 20 ? 'лет' : b === 1 ? 'год' : b >= 2 && b <= 4 ? 'года' : 'лет'; };
const ЗНАКИ = [
  [1, 20, 'Козерог', '♑', 'земля'], [2, 19, 'Водолей', '♒', 'воздух'], [3, 21, 'Рыбы', '♓', 'вода'], [4, 20, 'Овен', '♈', 'огонь'],
  [5, 21, 'Телец', '♉', 'земля'], [6, 21, 'Близнецы', '♊', 'воздух'], [7, 23, 'Рак', '♋', 'вода'], [8, 23, 'Лев', '♌', 'огонь'],
  [9, 23, 'Дева', '♍', 'земля'], [10, 23, 'Весы', '♎', 'воздух'], [11, 22, 'Скорпион', '♏', 'вода'], [12, 22, 'Стрелец', '♐', 'огонь'],
];
const СРОКИ_ЗНАКОВ = { Овен: '21.03 — 19.04', Телец: '20.04 — 20.05', Близнецы: '21.05 — 20.06', Рак: '21.06 — 22.07', Лев: '23.07 — 22.08', Дева: '23.08 — 22.09', Весы: '23.09 — 22.10', Скорпион: '23.10 — 21.11', Стрелец: '22.11 — 21.12', Козерог: '22.12 — 19.01', Водолей: '20.01 — 18.02', Рыбы: '19.02 — 20.03' };
// Созвездия упрощённо: ломаные в поле 10×10.
const СОЗВЕЗДИЯ = {
  Овен: [[[1.5, 6.5], [5, 4.6], [7.6, 4], [8.6, 4.8]]],
  Телец: [[[1, 2], [3.8, 4.4], [5.2, 5.2], [7.2, 4.2], [9, 2]], [[5.2, 5.2], [4.4, 7.4], [2.6, 8.8]]],
  Близнецы: [[[2, 1.5], [2.6, 5], [3, 8.5]], [[6.4, 1.2], [6.8, 4.8], [7.4, 8.6]], [[2.6, 5], [6.8, 4.8]]],
  Рак: [[[5, 1.5], [5, 5], [2.5, 8.5]], [[5, 5], [8, 8]]],
  Лев: [[[8.5, 2.5], [7, 1.5], [5.6, 2.4], [5.8, 4], [7.2, 4.6], [6.6, 6.6], [3, 7.4], [1.5, 6], [3.4, 4.8], [5.8, 4]]],
  Дева: [[[1, 3], [3, 3.6], [5, 4.6], [7, 4], [9, 2.6]], [[5, 4.6], [4.6, 7], [3, 9]], [[7, 4], [7.6, 7], [9, 8.6]]],
  Весы: [[[2, 6.5], [5, 2], [8, 6.5], [2, 6.5]], [[5, 2], [5, 8.8]]],
  Скорпион: [[[1, 2], [2.6, 3], [3.6, 4.2], [4.6, 5.6], [5.4, 7], [6.8, 8], [8.4, 7.6], [9, 6.2]]],
  Стрелец: [[[2, 8], [4, 6], [6, 4], [8, 2]], [[6, 2], [8, 2], [8, 4]], [[3, 4], [5, 6]]],
  Козерог: [[[1.5, 2.5], [5, 7.5], [8.5, 3], [1.5, 2.5]]],
  Водолей: [[[1, 3], [3, 4.6], [5, 3], [7, 4.6], [9, 3]], [[1, 6.4], [3, 8], [5, 6.4], [7, 8], [9, 6.4]]],
  Рыбы: [[[1.5, 2], [3.4, 5], [5, 8.5], [6.6, 5], [8.5, 2.2]], [[1.5, 2], [.8, 3.4], [2.2, 3.6], [1.5, 2]]],
};
const СТИХИИ = { огонь: ['fire', 'flame'], земля: ['earth', 'M3 19 9 9l4 6 3-4 5 8Z M7.5 12.5l1.5-1.5'], воздух: ['air', 'wave'], вода: ['water', 'drop'] };
function знакЗодиака(д, м) {
  const [, граница, ...этот] = ЗНАКИ[м - 1];
  return д < граница ? этот : ЗНАКИ[м % 12].slice(2);
}
function разобратьВозраст(value) {
  const s = String(value).trim();
  const m = s.match(/^\s*(\d{1,3})(?!\d)/);
  if (!m) return null;
  let n = +m[1];
  // Возраст малыша («40 дней», «1 год 2 мес. 5 дн., род. 07.09.2024»): слово
  // возраста берём целиком, а не «N лет».
  const мал = s.match(/^\s*((?:\d{1,3}\s*(?:год[а]?|лет|мес\.?|месяц\w*|нед\.?|недел\w*|дн\.?|дн\w*|день|сут\w*)\s*)+)/i);
  const малыш = мал && /мес|нед|дн|день|сут/i.test(мал[1]);
  const слово = малыш ? мал[1].trim() : `${n} ${годы(n)}`;
  if (малыш) { const г = мал[1].match(/(\d+)\s*(?:год|лет)/i); n = г ? +г[1] : 0; }
  const хвост = (малыш ? s.slice(мал[0].length).replace(/^\s*[,;—–-]?\s*(?:род\.?|родил\w*)?\s*/i, '') : s.slice(m[0].length).replace(/^\s*(?:лет|года?|y\.?o\.?)?\s*[,;—–-]?\s*/i, '')).trim();
  const д = хвост.match(/(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?/);
  const знак = д ? знакЗодиака(+д[1], огр(+д[2], 1, 12)) : null;
  const остаток = д ? хвост.replace(д[0], '').replace(/^[\s,;—–-]+|[\s,;—–-]+$/g, '') : '';
  return { n, хвост, д, знак, остаток, слово, малыш };
}
function видВозраста(value, вид) {
  const в = разобратьВозраст(value);
  if (!в) return '';
  const { n, хвост, д, знак, остаток, слово, малыш } = в;
  if (вид === 'id') {
    // Удостоверение: гильош, голограмма, фото с печатью, машиночитаемая зона.
    const гильош = Array.from({ length: 7 }, (_, k) => {
      let p = '';
      for (let x = 0; x <= 200; x += 5) p += `${x ? 'L' : 'M'}${x} ${ф(50 + Math.sin(x / 13 + k * .9) * (14 + k * 3) * Math.cos(x / 41 + k))}`;
      return путь(p);
    }).join('');
    const дата = д ? `${д[1].padStart(2, '0')}${д[2].padStart(2, '0')}${(д[3] || '').slice(-2)}` : '';
    const мрз1 = ('IDRUS<<AGE<' + n + '<<' + (знак ? знак[0].toUpperCase().replace(/[^A-ZА-Я]/g, '') : '')).padEnd(30, '<').slice(0, 30);
    const мрз2 = ((дата || '000000') + '<' + String(n).padStart(3, '0') + '<<' + String(зерно(value) % 100000).padStart(5, '0')).padEnd(30, '<').slice(0, 30);
    return обёртка('age', 'id', `<div class="pass"><svg class="guill" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true">${гильош}</svg><i class="holo" aria-hidden="true"></i>`
      + `<div class="pass-head"><span>Удостоверение личности</span><svg class="emb" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="${ИКОНКИ.star}"/></svg></div>`
      + `<div class="pass-body"><span class="photo" aria-hidden="true"><svg viewBox="0 0 100 120"><path d="${БЮСТ}"/></svg><i class="seal"></i></span>`
      + `<dl><div><dt>Возраст</dt><dd>${т(слово)}</dd></div>${д ? `<div><dt>Дата рождения</dt><dd>${т(д[0])}</dd></div>` : хвост ? `<div><dt>Примечание</dt><dd>${т(хвост)}</dd></div>` : ''}${знак ? `<div><dt>Знак</dt><dd>${знак[0]}</dd></div>` : ''}${остаток ? `<div><dt>Примечание</dt><dd>${т(остаток)}</dd></div>` : ''}</dl><i class="chip" aria-hidden="true"></i></div>`
      + `<code class="mrz" aria-hidden="true">${escapeHtml(мрз1)}<br>${escapeHtml(мрз2)}</code></div>`);
  }
  if (вид === 'zodiac') {
    if (!знак) return '';
    const [имя, глиф, стихия] = знак;
    const id = новыйId('zd'), r = генератор(имя + n);
    const фон = Array.from({ length: 34 }, () => { const a = r() * Math.PI * 2, d = r() * 44; return `<circle cx="${ф(60 + Math.cos(a) * d)}" cy="${ф(60 + Math.sin(a) * d)}" r="${ф(.25 + r() * .55)}"/>`; }).join('');
    const кольцо = ЗНАКИ.map(([, , и, г], i) => {
      const a0 = (i / 12) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / 12) * Math.PI * 2 - Math.PI / 2, am = (a0 + a1) / 2;
      const дуга = `M${ф(60 + 57 * Math.cos(a0))} ${ф(60 + 57 * Math.sin(a0))}A57 57 0 0 1 ${ф(60 + 57 * Math.cos(a1))} ${ф(60 + 57 * Math.sin(a1))}L${ф(60 + 47 * Math.cos(a1))} ${ф(60 + 47 * Math.sin(a1))}A47 47 0 0 0 ${ф(60 + 47 * Math.cos(a0))} ${ф(60 + 47 * Math.sin(a0))}Z`;
      return `<path class="seg${и === имя ? ' is-me' : ''}" d="${дуга}"/><text class="g${и === имя ? ' is-me' : ''}" x="${ф(60 + 52 * Math.cos(am))}" y="${ф(60 + 52 * Math.sin(am) + 2.2)}">${г}︎</text>`;
    }).join('');
    const точка = ([x, y]) => [32 + x * 5.6, 32 + y * 5.6];
    const линии = СОЗВЕЗДИЯ[имя].map(л => `<polyline class="cl" points="${л.map(p => точка(p).map(ф).join(',')).join(' ')}"/>`).join('');
    const звёзды = [...new Map(СОЗВЕЗДИЯ[имя].flat().map(p => [p.join(), p])).values()].map((p, i) => { const [x, y] = точка(p); return `<circle class="cs" style="--i:${i}" cx="${ф(x)}" cy="${ф(y)}" r="${i % 3 ? 1.5 : 2.2}"/>`; }).join('');
    const [эл, знач] = СТИХИИ[стихия];
    return обёртка('age', 'zodiac', `<svg class="chart" viewBox="0 0 120 120" aria-hidden="true"><defs><radialGradient id="${id}"><stop offset="0" class="s0"/><stop offset="1" class="s1"/></radialGradient></defs>`
      + `<circle class="sky" cx="60" cy="60" r="57" fill="url(#${id})"/><g class="bg">${фон}</g>${кольцо}<circle class="rim" cx="60" cy="60" r="47"/><circle class="rim" cx="60" cy="60" r="57"/>${линии}${звёзды}</svg>`
      + `<span class="zod-text"><b class="glyph">${глиф}︎</b><strong>${имя}</strong><small>${СРОКИ_ЗНАКОВ[имя]}</small>`
      + `<span class="elem el-${эл}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ИКОНКИ[знач] || знач}"/></svg>${стихия}</span>`
      + `<em>${т(слово)}${д ? ' · ' + т(д[0]) : ''}</em>${остаток ? `<em>${т(остаток)}</em>` : ''}</span>`);
  }
  if (вид === 'rings') {
    // Срез дерева: по кольцу на год, кольца неровные и смещены, как у живого
    // ствола; в середине тёмная сердцевина, сбоку трещина и бирка.
    const колец = огр(n, 3, 48), r = генератор('rings' + n);
    const кольцо = (R, k, класс) => {
      let p = '';
      for (let i = 0; i <= 48; i++) {
        const a = i / 48 * Math.PI * 2;
        const rr = R * (1 + .045 * Math.sin(3 * a + k) + .03 * Math.sin(5 * a + k * 2.1) + .015 * Math.sin(9 * a + k));
        p += `${i ? 'L' : 'M'}${ф(52 + Math.cos(a) * rr * 1.04 + R * .06)} ${ф(52 + Math.sin(a) * rr)}`;
      }
      return `<path class="${класс}" d="${p}Z"/>`;
    };
    const кольца = Array.from({ length: колец }, (_, i) => кольцо(4 + (i + 1) * (38 / колец), i * .7 + r() * .4, 'yr' + (i % 5 === 4 ? ' is-5' : ''))).join('');
    return обёртка('age', 'rings', `<svg class="slice" viewBox="0 0 104 104" aria-hidden="true">${кольцо(49, 0, 'bark')}${кольцо(45, .3, 'wood')}${кольца}${кольцо(6, 1, 'heart')}`
      + `<path class="crack" d="M57 52 72 41l3 2 9-9M66 46l2 6"/><circle class="knot" cx="34" cy="64" r="2.4"/></svg>`
      + `<span class="label"><i class="pin" aria-hidden="true"></i>${малыш ? `<b>${т(слово.match(/^\d+/)[0])}</b><small>${т(слово.replace(/^\d+\s*/, ''))}</small>` : `<b>${n}</b><small>${годы(n)} · ${колец === n ? `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'кольцо' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'кольца' : 'колец'}` : 'кольца'}</small>`}${хвост ? `<em>${т(хвост)}</em>` : ''}</span>`);
  }
  return '';
}

/* =============================== ОДЕЖДА ================================== */

const ВЕЩИ = [
  [/плать|сарафан/i, 'dress', 'M9 3h6l-1 4 4 13H6l4-13Z M9 3l-2 2 M15 3l2 2'],
  [/футбол|майк|топ\b|худи|свитер|кофт|водолазк/i, 'tee', 'M8 4 4 7l2 3 2-1v11h8V9l2 1 2-3-4-3c-.6 1.4-2 2-4 2s-3.4-.6-4-2Z'],
  [/рубаш|блуз/i, 'shirt', 'M8 4 4 7l2 3 2-1v11h8V9l2 1 2-3-4-3-4 4Z M12 8v12 M11 11h.01 M11 14h.01'],
  [/брюк|штан|джинс|леггинс|шорт/i, 'pants', 'M7 3h10l1 18h-4l-2-11-2 11H6Z M7 6h10'],
  [/юбк/i, 'skirt', 'M8 5h8l3 14H5Z M8 8h8'],
  [/пальто|куртк|пиджак|жакет|плащ|мантия|кардиган/i, 'coat', 'M8 3 4 6v15h5V9l3 4 3-4v12h5V6l-4-3-4 6Z'],
  [/туфл|ботин|сапог|кроссов|кед|босонож|обув|тапк|каблук/i, 'shoe', 'M3 15h5l2-3c3 0 6 1 8 3h3v3H3Z M8 15v3'],
  [/чулк|носк|колгот/i, 'sock', 'M9 3h5v9l3 5a2.5 2.5 0 0 1-4 3l-4-6Z'],
  [/бель|бюстг|трус|лиф|корсет/i, 'lingerie', 'M4 8c2 3 6 3 8 0 2 3 6 3 8 0 M4 8l1-4 M20 8l-1-4 M8 14h8l-1 5H9Z'],
  [/шарф|платок|галстук/i, 'scarf', 'M6 4c4 2 8 2 12 0v4c-4 2-8 2-12 0Z M14 8v12l-3-2'],
  [/шапк|шляп|кепк|берет|капюшон/i, 'hat', 'M4 16h16 M6 16c0-5 2.5-9 6-9s6 4 6 9'],
];
const вещь = (x) => ВЕЩИ.find(([rx]) => rx.test(x)) || [null, 'item', 'M12 4a2 2 0 0 1 2 2c0 1-2 1.5-2 3 M12 9 3 16h18Z'];
const УХОД = [
  'M4 9h16l-2 9H6Z M7 12c1.6-1 3.4-1 5 0s3.4 1 5 0', 'M12 4 21 19H3Z M6 8l12 10 M18 8 6 18', 'M4 17h16l-1-5c-1-3-3-4-6-4H8l-2 3 M13 13h.01 M16 13h.01',
  'M12 12m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0', 'M4 4h16v16H4Z M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0',
];
function видОдежды(value, вид) {
  const в = куски(value);
  if (!в.length) return '';
  if (вид === 'hanger') {
    // Гардероб: штанга, на ней вешалки, на каждой — бирка-силуэт вещи.
    return обёртка('clothes', 'hanger', `<div class="rack">${в.map((x, i) => {
      const [, , d] = вещь(x);
      return `<div class="hang" style="--i:${i};--h:${(i * 47) % 360 - 180}"><svg class="hanger" viewBox="0 0 60 30" aria-hidden="true"><path d="M30 12c0-3 3-3.4 3-6.4a3 3 0 0 0-6 .2"/><path d="M30 12 4 27h52Z"/></svg>`
        + `<div class="garment"><svg class="sil" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg><span>${т(с1(x))}</span></div></div>`;
    }).join('')}</div>`);
  }
  if (вид === 'layers') {
    // Книга образцов ткани: зубчатые лоскуты внахлёст, у каждого своё плетение.
    const ткань = (x) => /шёлк|шелк|атлас|сатин/i.test(x) ? 'silk' : /джинс|деним/i.test(x) ? 'denim' : /кружев|чулк|колгот|сетк|капрон/i.test(x) ? 'lace'
      : /вязан|свитер|кардиган|шерст/i.test(x) ? 'knit' : /кож|замш|лакир/i.test(x) ? 'leather' : /бархат|вельвет/i.test(x) ? 'velvet' : 'linen';
    const ИМЕНА = { silk: 'шёлк', denim: 'деним', lace: 'кружево', knit: 'вязка', leather: 'кожа', velvet: 'бархат', linen: 'ткань' };
    return обёртка('clothes', 'layers', `<div class="book">${в.map((x, i) => `<div class="swatch f-${ткань(x)}" style="--i:${i};--h:${(i * 61) % 300 - 150}">`
      + `<span class="cloth" aria-hidden="true"></span><span class="lbl"><small>${i === 0 ? 'сверху' : i === в.length - 1 ? 'ближе к телу' : `слой ${i + 1}`} · ${ИМЕНА[ткань(x)]}</small><b>${т(с1(x))}</b></span></div>`).join('')}</div>`);
  }
  if (вид === 'tags') {
    // Вшивные бирки: атласная лента с петлёй, тканая строка, значки ухода.
    return обёртка('clothes', 'tags', в.map((x, i) => `<div class="label" style="--h:${(i * 83) % 320 - 160};--r:${[-1.5, 1, -.5, 1.8][i % 4]}deg">`
      + `<i class="loop" aria-hidden="true"></i><span class="woven">${т(x)}</span>`
      + `<span class="care" aria-hidden="true">${[0, 1, 2, 3, 4].filter((_, k) => (k + i) % 5 !== 4).slice(0, 3 + (i % 2)).map(k => `<svg viewBox="0 0 24 24"><path d="${УХОД[(k + i) % 5]}"/></svg>`).join('')}</span></div>`).join(''));
  }
  return '';
}

/* ============================== ВНЕШНОСТЬ ================================ */

const ПРИМЕТЫ = [
  ['Рост', /\d{2,3}\s*см|\bрост|высок|невысок|низк|миниатюр/i, 'leg', [0, 0]],
  ['Сложение', /строй|худ|полн|плотн|широк|хрупк|спортив|мускул|сложен|фигур|изящн|крепк/i, 'torso', [50, 92]],
  ['Волосы', /волос|стриж|кос[аы]\b|локон|кудр|блонд|брюнет|рыж|шатен|лыс|чёлк|челк/i, 'head', [50, 14]],
  ['Глаза', /глаз|взгляд|ресниц/i, 'eye', [58, 33]],
  ['Кожа', /кож[аеи]|загар|веснуш|бледн|смугл/i, 'drop', [38, 42]],
  ['Приметы', /шрам|родинк|татуир|тату|пирсинг|ожог|щетин|бород|\bус[ыа]?\b|очки/i, 'star', [56, 48]],
  ['Лицо', /лиц|губ|скул|нос\b|брови|улыб/i, 'mask', [50, 50]],
];
const примета = (x) => ПРИМЕТЫ.find(([, rx]) => rx.test(x)) || ['Облик', null, 'diamond', [50, 104]];
function видВнешности(value, вид) {
  const в = куски(value);
  if (!в.length) return '';
  if (вид === 'traits') {
    // Силуэт с пронумерованными метками: где на нём каждая черта.
    const рост = в.map(x => x.match(/(\d{3})\s*см/)).find(Boolean);
    const точки = в.map((x, i) => { const [имя, , , [px, py]] = примета(x); return имя === 'Рост' ? null : `<g class="dot" style="--i:${i}"><circle cx="${px + (i % 2 ? 3 : -3) * (i > 3)}" cy="${py}" r="4.6"/><text x="${px + (i % 2 ? 3 : -3) * (i > 3)}" y="${py + 2.2}">${i + 1}</text></g>`; }).filter(Boolean).join('');
    const линейка = рост ? `<g class="ruler">${Array.from({ length: 13 }, (_, k) => `<path d="M2 ${8 + k * 9}h${k % 4 ? 3 : 6}"/>`).join('')}<path class="bar" d="M2 8v108"/><text x="9" y="6">${рост[1]}</text></g>` : '';
    const пункт = (x, i) => `<li style="--i:${i}"><b>${i + 1}</b><span><small>${примета(x)[0]}</small>${т(с1(x))}</span></li>`;
    const пол = Math.ceil(в.length / 2);
    return обёртка('looks', 'traits', `<ul class="side l">${в.slice(0, пол).map((x, i) => пункт(x, i)).join('')}</ul>`
      + `<svg class="fig" viewBox="-2 0 104 122" aria-hidden="true"><defs><linearGradient id="${новыйId('lk')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="f0"/><stop offset="1" class="f1"/></linearGradient></defs><path class="body" d="${БЮСТ}"/><path class="scan" d="M10 60h80"/>${линейка}${точки}</svg>`
      + `<ul class="side r">${в.slice(пол).map((x, i) => пункт(x, i + пол)).join('')}</ul>`);
  }
  if (вид === 'profile') {
    // Ориентировка: пожелтевший бланк, рост-линейка за силуэтом, отпечаток.
    const строки = new Map();
    for (const x of в) { const [имя] = примета(x); if (!строки.has(имя)) строки.set(имя, []); строки.get(имя).push(x); }
    const отпечаток = Array.from({ length: 7 }, (_, k) => `<path d="M${12 - k * 1.4} ${22 - k * .4}c0-${4 + k * 2} ${2 + k} -${6 + k * 1.6} ${k * 1.4 + 0} -${6 + k * 1.6}s${k + 2} ${2 + k * 1.6} ${k + 2} ${6 + k * 2}"/>`).join('');
    return обёртка('looks', 'profile', `<div class="sheet"><div class="hdr"><b>Ориентировка</b><span class="stamp">разыскивается</span></div>`
      + `<div class="mug" aria-hidden="true">${[190, 180, 170, 160, 150].map(h => `<i><s>${h}</s></i>`).join('')}<svg viewBox="0 0 100 120"><path d="${БЮСТ}"/></svg></div>`
      + `<dl>${[...строки].map(([имя, что]) => `<div><dt>${имя}</dt><dd>${что.map(т).join(', ')}</dd></div>`).join('')}</dl>`
      + `<svg class="print" viewBox="0 0 24 26" aria-hidden="true">${отпечаток}</svg></div>`);
  }
  if (вид === 'sketch') {
    // Скетчбук: пружина сверху, заметки от руки по клетке, карандаш.
    return обёртка('looks', 'sketch', `<div class="pad"><i class="spiral" aria-hidden="true"></i>`
      + `<ul class="notes">${в.map((x, i) => `<li style="--i:${i}"><i aria-hidden="true">→</i>${т(x)}</li>`).join('')}</ul>`
      + `<svg class="pencil" viewBox="0 0 80 14" aria-hidden="true"><path class="wood" d="M10 2h56v10H10Z"/><path class="tip" d="M10 2 1 7l9 5Z"/><path class="lead" d="M3.6 5.6 1 7l2.6 1.4Z"/><path class="band" d="M66 2h5v10h-5Z"/><path class="eraser" d="M71 2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-6Z"/></svg></div>`);
  }
  return '';
}

/* ================================= РОЛЬ ================================== */

function видРоли(value, вид) {
  const [главное, ...ещё] = куски(value);
  if (!главное) return '';
  const буква = т(с1(главное).charAt(0));
  if (вид === 'badge') {
    // Пропуск на ленте: ремешок, карабин, прорезь, шапка с монограммой,
    // фото-силуэт, штрихкод и QR-узор из названия роли.
    const r = генератор(главное), qr = [];
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
      const угол = (x < 3 && y < 3) || (x > 5 && y < 3) || (x < 3 && y > 5);
      if (угол ? ((x % 6 === 0 || x % 6 === 2 || y % 6 === 0 || y % 6 === 2) || (x % 6 === 1 && y % 6 === 1)) : r() > .52) qr.push(`M${x} ${y}h1v1h-1Z`);
    }
    return обёртка('role', 'badge', `<i class="strap" aria-hidden="true"></i><i class="clasp" aria-hidden="true"></i>`
      + `<div class="card"><i class="slot" aria-hidden="true"></i><div class="top"><span class="mono">${буква}</span><span>Пропуск<small>доступ разрешён</small></span></div>`
      + `<div class="mid"><span class="ph" aria-hidden="true"><svg viewBox="0 0 100 120"><path d="${БЮСТ}"/></svg></span><span class="who"><b>${т(с1(главное))}</b>${ещё.map(x => `<small>${т(x)}</small>`).join('')}</span></div>`
      + `<div class="bot" aria-hidden="true"><i class="bars"></i><svg class="qr" viewBox="0 0 9 9"><path d="${qr.join('')}"/></svg></div></div>`);
  }
  if (вид === 'ribbon') {
    // Орден: колодка с лентой в цветах темы, звезда с лаврами и монограммой;
    // остальные роли — наградными планками.
    const id = новыйId('md');
    const лучи = Array.from({ length: 16 }, (_, k) => { const a = k / 16 * Math.PI * 2, r1 = k % 2 ? 19 : 24; return `${ф(40 + Math.cos(a) * r1)},${ф(64 + Math.sin(a) * r1)}`; }).join(' ');
    const листья = Array.from({ length: 14 }, (_, k) => { const a = Math.PI * (.62 + k / 13 * .76) * (k < 7 ? 1 : 1), сторона = k < 7 ? -1 : 1, t = (k % 7) / 6;
      const ang = Math.PI / 2 + сторона * (0.35 + t * 2.1), x = 40 + Math.cos(ang) * 15, y = 64 + Math.sin(ang) * 15;
      return `<ellipse class="leaf" cx="${ф(x)}" cy="${ф(y)}" rx="1.6" ry="3.4" transform="rotate(${ф(ang * 180 / Math.PI + 90)} ${ф(x)} ${ф(y)})"/>`; }).join('');
    return обёртка('role', 'ribbon', `<svg class="medal" viewBox="0 0 80 92" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="g0"/><stop offset=".5" class="g1"/><stop offset="1" class="g2"/></linearGradient></defs>`
      + `<path class="rib" d="M24 0h32l-6 40H30Z"/><path class="rib-s" d="M34 0h4l-1 40h-2ZM42 0h4l-2 40h-2Z"/><path class="rib-edge" d="M24 0l6 40M56 0l-6 40"/><rect class="clasp" x="27" y="36" width="26" height="6" rx="2" fill="url(#${id})"/>`
      + `<polygon class="star" points="${лучи}" fill="url(#${id})"/><circle class="disc" cx="40" cy="64" r="13.5"/>${листья}<circle class="core" cx="40" cy="64" r="9" fill="url(#${id})"/><text class="mono" x="40" y="68.4">${буква}</text></svg>`
      + `<div class="title"><small>звание</small><b>${т(с1(главное))}</b>${ещё.length ? `<ul class="bars">${ещё.map((x, i) => `<li style="--h:${(i * 71) % 300 - 150}"><i aria-hidden="true"></i>${т(x)}</li>`).join('')}</ul>` : ''}</div>`);
  }
  if (вид === 'stack') {
    // Визитка: плотный картон, фольгированная рамка и монограмма; позади
    // вторая карточка, при наведении верхняя приподнимается.
    return обёртка('role', 'stack', `<div class="cards"><div class="back" aria-hidden="true"><span>${буква}</span></div><div class="front">`
      + `<span class="mono" aria-hidden="true">${буква}</span><b>${т(с1(главное))}</b><i class="hair" aria-hidden="true"></i>`
      + (ещё.length ? `<small>${ещё.map(т).join('<i class="dia" aria-hidden="true">◆</i>')}</small>` : '') + `<i class="orn" aria-hidden="true">❦︎</i></div></div>`);
  }
  return '';
}

/* ================================ ТЕЛО ==================================== */

const СИЛУЭТ = 'M12 2.6a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Z M8.4 9.4h7.2l1.6 6.2-1.8.4-1.2-4v11.4h-2V17h-.4v6.4h-2V12l-1.2 4-1.8-.4Z';
// Тело: силуэт и ощущения столбиком по «позвоночнику».
export function видТела(value) {
  const в = куски(value);
  if (!в.length) return '';
  return `<div class="hud-v hud-f hud-f-body"><svg class="hud-f-fig" viewBox="0 0 24 26" aria-hidden="true"><path d="${СИЛУЭТ}"/></svg>`
    + `<ul>${в.map((x, i) => `<li style="--i:${i}">${т(с1(x))}</li>`).join('')}</ul></div>`;
}

/* ============================== ФИЗИОЛОГИЯ =============================== */

const ОЩУЩЕНИЯ = [
  [/жар|горяч|пыла|знобит|озноб|температур/i, 'flame', 'head'], [/пить|рот|жажд|пересох|слюн|губ/i, 'drop', 'mouth'],
  [/возбужд|желан|влеч|томлен|страст/i, 'heart', 'pelvis'], [/хмел|вин|пьян|алкогол|коньяк|пив/i, 'cup', 'head'],
  [/боль|ноет|ныть|тян|спазм|колет|ломит/i, 'bolt', 'belly'], [/устал|сонн|сон\b|вял|изнем|разбит/i, 'moon', 'chest'],
  [/дрож|трясёт|трясет|мурашк|дыхан|задыха/i, 'wave', 'arms'], [/сердц|пульс|колотит/i, 'hearts', 'chest'], [/голод|сыт|тошн|живот/i, 'box', 'belly'],
];
const ощущение = (x) => ОЩУЩЕНИЯ.find(([rx]) => rx.test(x)) || [null, 'star', 'chest'];
const силаОщущения = (x) => /сильн|очень|пылает|остр|невыносим|жутк|бешен|на пределе/i.test(x) ? 3 : /лёгк|легк|слегка|немного|чуть|едва|слаб/i.test(x) ? 1 : 2;
const СИЛА_СЛОВОМ = ['', 'слабо', 'заметно', 'сильно'];
// Своя кривая у каждого ощущения: жар — рваный, жажда — медленная волна,
// сердце — кардиограмма, дрожь — частая рябь, боль — пики, усталость — плато.
function кривая(знач, s, сид) {
  const r = генератор(сид); let p = 'M0 10';
  for (let x = 2; x <= 60; x += 2) {
    let y = 10;
    if (знач === 'flame') y = 10 - r() * 7 * s / 3 - Math.sin(x / 3) * 2;
    else if (знач === 'drop') y = 10 - Math.sin(x / 6) * 5 * s / 3;
    else if (знач === 'heart' || знач === 'hearts') { const ф2 = x % 20; y = ф2 === 8 ? 10 - 8 * s / 3 : ф2 === 10 ? 10 + 4 : ф2 === 12 ? 10 - 2 : 10; }
    else if (знач === 'wave') y = 10 - Math.sin(x * 1.3) * 3.6 * s / 3;
    else if (знач === 'bolt') y = x % 14 === 6 ? 10 - 8 * s / 3 : 10 + r() * 1.2;
    else if (знач === 'moon') y = 10 - Math.sin(x / 18) * 2 + r() * .6;
    else y = 10 - Math.sin(x / 4 + r()) * 3 * s / 3;
    p += ` L${x} ${ф(y)}`;
  }
  return p;
}
const ТОЧКИ_ТЕЛА = { head: [50, 14], mouth: [50, 22], chest: [50, 44], belly: [50, 62], pelvis: [50, 78], arms: [26, 56] };
// Фигура для тепловизора: симметричная, ось — x = 50.
const ФИГУРА = 'M50 4a11 11 0 1 0 0 22a11 11 0 1 0 0-22Z M38 30H62C68 30 72 34 73 40L78 70L72 72L66 48V76L69 118H60L56 82H44L40 118H31L34 76V48L28 72L22 70L27 40C28 34 32 30 38 30Z';
function видФизиологии(value, вид) {
  const в = куски(value);
  if (!в.length) return '';
  if (вид === 'sensors') {
    // Пульт датчиков: дуга-шкала, значок, своя кривая и слово силы.
    return обёртка('phys', 'sensors', в.map((x, i) => {
      const [, знач] = ощущение(x), s = силаОщущения(x), L = 2 * Math.PI * 15 * .75;
      return `<div class="tile s${s}" style="--i:${i}"><svg class="gauge" viewBox="0 0 40 40" aria-hidden="true"><circle class="trk" cx="20" cy="20" r="15" style="stroke-dasharray:${ф(L)} 200"/><circle class="val" cx="20" cy="20" r="15" style="stroke-dasharray:${ф(L * s / 3)} 200"/>`
        + `<g transform="translate(12 12) scale(.66)"><path class="ic" d="${svgИко(знач)}"/></g></svg>`
        + `<span class="txt"><b>${т(с1(x))}</b><small>${СИЛА_СЛОВОМ[s]}</small></span><svg class="line" viewBox="0 0 60 20" preserveAspectRatio="none" aria-hidden="true"><path d="${кривая(знач, s, x)}"/></svg></div>`;
    }).join(''));
  }
  if (вид === 'bubbles') {
    // Бокал: в нём поднимаются пузырьки, рядом ощущения переливчатыми шарами.
    const r = генератор(value);
    const пуз = Array.from({ length: 14 }, (_, k) => `<circle class="b" style="--i:${k}" cx="${ф(28 + r() * 24)}" cy="${ф(30 + r() * 30)}" r="${ф(.8 + r() * 1.8)}"/>`).join('');
    const id = новыйId('gl');
    return обёртка('phys', 'bubbles', `<svg class="glass" viewBox="0 0 80 120" aria-hidden="true"><defs><clipPath id="${id}"><path d="M18 12h44c0 30-6 52-22 56-16-4-22-26-22-56Z"/></clipPath><linearGradient id="${id}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="l0"/><stop offset="1" class="l1"/></linearGradient></defs>`
      + `<g clip-path="url(#${id})"><rect class="liq" x="0" y="${ф(40 - Math.min(в.length, 5) * 3)}" width="80" height="80" fill="url(#${id}l)"/><path class="surf" d="M0 ${ф(40 - Math.min(в.length, 5) * 3)}q10-3 20 0t20 0 20 0 20 0"/>${пуз}</g>`
      + `<path class="cup" d="M18 12h44c0 30-6 52-22 56-16-4-22-26-22-56Z"/><path class="stem" d="M40 68v34M24 108c4-4 28-4 32 0"/><path class="shine" d="M24 18c0 14 2 28 8 38"/></svg>`
      + `<div class="cluster">${в.map((x, i) => `<span class="orb s${силаОщущения(x)}" style="--i:${i};--h:${(i * 53) % 200 - 100}"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${svgИко(ощущение(x)[1])}"/></svg>${т(x)}</span>`).join('')}</div>`);
  }
  if (вид === 'readout') {
    // Тепловизор: фигура в тепловых пятнах там, где ощущение живёт в теле,
    // сбоку шкала температур, поверх прицел и развёртка.
    const id = новыйId('th');
    const пятна = в.map((x, i) => { const [, , где] = ощущение(x), s = силаОщущения(x), [px, py] = ТОЧКИ_ТЕЛА[где];
      return `<circle cx="${где === 'arms' && i % 2 ? 100 - px : px}" cy="${py}" r="${10 + s * 6}" fill="url(#${id}h${s})"/>`; }).join('');
    return обёртка('phys', 'readout', `<div class="cam"><svg class="therm" viewBox="0 0 100 130" aria-hidden="true"><defs><clipPath id="${id}c"><path d="${ФИГУРА}"/></clipPath>`
      + [1, 2, 3].map(s => `<radialGradient id="${id}h${s}"><stop offset="0" class="t${s}a"/><stop offset=".55" class="t${s}b"/><stop offset="1" class="t0"/></radialGradient>`).join('')
      + `</defs><path class="cold" d="${ФИГУРА}"/><g clip-path="url(#${id}c)">${пятна}</g><path class="outline" d="${ФИГУРА}"/>`
      + `<path class="cross" d="M50 40v-10M50 52v10M40 46h-10M60 46h10"/><circle class="cross" cx="50" cy="46" r="5"/></svg>`
      + `<i class="scale" aria-hidden="true"><s>HI</s><s>LO</s></i><span class="hud-corner tl" aria-hidden="true"></span><span class="hud-corner br" aria-hidden="true"></span><span class="rec" aria-hidden="true">IR · ${String(в.length).padStart(2, '0')}</span></div>`
      + `<ul class="reads">${в.map(x => { const s = силаОщущения(x); return `<li class="s${s}"><i aria-hidden="true"></i><span>${т(с1(x))}</span><b>${['', '+', '++', '+++'][s]}</b></li>`; }).join('')}</ul>`);
  }
  return '';
}

/* ================================ МЕСТО =================================== */

function видМеста(value, вид) {
  const в = куски(value);
  if (!в.length) return '';
  if (вид === 'crumbs') {
    // Линия метро: станции сверху вниз, последняя — «вы здесь».
    return обёртка('place', 'crumbs', `<ol class="line">${в.map((x, i) => `<li class="${i === в.length - 1 ? 'is-here' : i === 0 ? 'is-start' : ''}" style="--i:${i}"><i class="st" aria-hidden="true"></i><span>${т(с1(x))}${i === в.length - 1 ? '<small>вы здесь</small>' : ''}</span></li>`).join('')}</ol>`);
  }
  if (вид === 'pin') {
    // Ключ с биркой: латунный ключ на кольце, на нитке — картонная бирка
    // с укреплённой дырочкой; на бирке — место, ниже — где именно.
    const [где, ...ещё] = в;
    const id = новыйId('ky');
    return обёртка('place', 'pin', `<svg class="key" viewBox="0 0 120 60" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="k0"/><stop offset=".5" class="k1"/><stop offset="1" class="k2"/></linearGradient></defs>`
      + `<circle class="ring" cx="16" cy="30" r="12"/><path class="bow" fill="url(#${id})" d="M40 30a12 12 0 1 1-24 0a12 12 0 1 1 24 0Zm-6 0a6 6 0 1 0-12 0a6 6 0 1 0 12 0Z"/>`
      + `<path class="shaft" fill="url(#${id})" d="M39 27h58l4 3-4 3H86v5h-4v-3h-4v5h-4v-5h-4v3h-4v-3H39Z"/><path class="groove" d="M46 30h46"/>`
      + `<path class="string" d="M16 18C26 2 60 2 112 12"/></svg>`
      + `<div class="tag"><i class="hole" aria-hidden="true"></i><b>${т(с1(где))}</b>${ещё.length ? `<ul>${ещё.map(x => `<li>${т(x)}</li>`).join('')}</ul>` : ''}</div>`);
  }
  if (вид === 'sign') {
    // Открытка: слева — место от руки, справа — марка с домиком, штемпель
    // и строчки адреса с уточнениями.
    const [где, ...ещё] = в;
    return обёртка('place', 'sign', `<div class="card"><div class="msg"><small>привет из</small><b>${т(с1(где))}</b><i class="sig" aria-hidden="true">— здесь и сейчас</i></div>`
      + `<div class="addr"><span class="stamp" aria-hidden="true"><svg viewBox="0 0 40 46"><rect class="sky" width="40" height="46"/><circle class="sun" cx="30" cy="12" r="5"/><path class="hill" d="M0 38c10-8 22-8 40-2v10H0Z"/><path class="house" d="M10 36V24l8-7 8 7v12Z"/><path class="roof" d="M8 25l10-9 10 9"/><rect class="win" x="15" y="27" width="5" height="5"/></svg></span>`
      + `<svg class="post" viewBox="0 0 70 40" aria-hidden="true"><circle cx="20" cy="20" r="16"/><circle cx="20" cy="20" r="12"/><text x="20" y="23">${String(зерно(где) % 28 + 1).padStart(2, '0')}·${String(зерно(где + 'm') % 12 + 1).padStart(2, '0')}</text><path d="M38 12c6-4 12 4 18 0s10-4 14 0M38 20c6-4 12 4 18 0s10-4 14 0M38 28c6-4 12 4 18 0s10-4 14 0"/></svg>`
      + `<ul class="lines">${(ещё.length ? ещё : [где]).map(x => `<li>${т(x)}</li>`).join('')}</ul></div></div>`);
  }
  return '';
}

/* ================================ СТАТУС ================================== */

function видСтатуса(value, вид) {
  const [главное, ...ещё] = куски(value);
  if (!главное) return '';
  if (вид === 'badge') {
    // Профиль в мессенджере: аватар с кольцом присутствия, статус и «о себе».
    return обёртка('status', 'badge', `<div class="prof"><span class="ava" aria-hidden="true"><svg viewBox="0 0 100 120"><path d="${БЮСТ}"/></svg><i class="on"></i></span>`
      + `<span class="who"><small>статус</small><b>${т(с1(главное))}</b><em><i aria-hidden="true"></i>в сети</em></span></div>`
      + (ещё.length ? `<div class="about">${ещё.map(x => `<p>${т(с1(x))}</p>`).join('')}<i class="tick" aria-hidden="true">✓✓</i></div>` : ''));
  }
  if (вид === 'stamp') {
    // Круглая печать: надпись по кругу, звёзды, статус поперёк; чернила
    // неровные, сама печать чуть повернута.
    const id = новыйId('st'), круг = 'СТАТУС ЗАВЕРЕН ✦ ЛИЧНОЕ ДЕЛО ✦ ';
    return обёртка('status', 'stamp', `<svg class="seal" viewBox="0 0 160 160" aria-hidden="true"><defs><path id="${id}" d="M80 80m-58 0a58 58 0 1 1 116 0a58 58 0 1 1-116 0"/>`
      + `<filter id="${id}f"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${зерно(главное) % 50}"/><feDisplacementMap in="SourceGraphic" scale="2.6"/></filter></defs>`
      + `<g filter="url(#${id}f)"><circle class="o" cx="80" cy="80" r="72"/><circle class="o2" cx="80" cy="80" r="66"/><circle class="o2" cx="80" cy="80" r="46"/>`
      + `<text class="ring"><textPath href="#${id}">${круг}${круг}</textPath></text><path class="star" d="M80 40l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/><path class="star" d="M80 106l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/></g></svg>`
      + `<span class="band"><b>${т(главное)}</b></span>${ещё.length ? `<small class="note">${ещё.map(т).join(' · ')}</small>` : ''}`);
  }
  if (вид === 'toggles') {
    // Неоновая вывеска: главный статус — стеклянной трубкой цвета темы,
    // остальные — тонкими трубками соседних оттенков; держатели и провод.
    return обёртка('status', 'toggles', `<div class="board"><i class="wire" aria-hidden="true"></i><span class="tube main"><i class="clip l" aria-hidden="true"></i><i class="clip r" aria-hidden="true"></i>${т(с1(главное))}</span>`
      + ещё.map((x, i) => `<span class="tube sub" style="--h:${[60, -60, 120, -120][i % 4]}">${т(с1(x))}</span>`).join('') + `</div>`);
  }
  return '';
}

/* ================================= КЛЮЧ =================================== */

function видКлюча(value, вид) {
  const п = String(value || '').split(';').map(x => x.trim()).filter(x => x && !пусто(x)).map(сЭмодзи);
  if (!п.length) return '';
  if (вид === 'stickers') {
    // Стикеры разного цвета: закрученный уголок, скотч или кнопка, почерк.
    return обёртка('key', 'stickers', п.map((x, i) => `<div class="note n${i % 4}" style="--r:${[-2.2, 1.6, -.8, 2.4][i % 4]}deg;--h:${[0, 40, 160, 260][i % 4]}">`
      + `<i class="${i % 2 ? 'pin' : 'tape'}" aria-hidden="true"></i>${x.значок ? `<i class="em">${x.значок}</i>` : ''}<p>${т(x.текст)}</p><i class="curl" aria-hidden="true"></i></div>`).join(''));
  }
  if (вид === 'bullets') {
    // Бусы: на нити стеклянные бусины разного цвета, в них — значки пунктов.
    return обёртка('key', 'bullets', `<svg class="thread" viewBox="0 0 20 100" preserveAspectRatio="none" aria-hidden="true"><path d="M10 0C2 20 18 30 10 50S2 80 10 100"/></svg>`
      + `<ol>${п.map((x, i) => `<li style="--i:${i};--h:${(i * 71) % 300 - 150}"><i class="bead" aria-hidden="true"><span>${x.значок || i + 1}</span></i><p>${т(x.текст)}</p></li>`).join('')}</ol>`);
  }
  if (вид === 'headlines') {
    // Телеграммы: бланк с красной полосой, на нём наклеены бумажные ленты
    // с текстом; в конце каждой — «тчк», в углу — штемпель «срочно».
    return обёртка('key', 'headlines', `<div class="form"><div class="head"><b>Телеграмма</b><span>${п.length} ${п.length === 1 ? 'слово' : 'важных'} · срочная</span><i class="urgent" aria-hidden="true">срочно</i></div>`
      + п.map((x, i) => `<p class="strip" style="--r:${[-.8, .6, -.3, .9][i % 4]}deg">${x.значок ? `<i class="em">${x.значок}</i>` : ''}<span>${т(x.текст)}</span><b aria-hidden="true">тчк</b></p>`).join('') + `</div>`);
  }
  return '';
}

/* ======================== ОЖИДАНИЕ VS РЕАЛЬНОСТЬ ========================== */

function видОжидания(value, вид) {
  const о = метки(value);
  const ждал = взять(о, 'xp', 'ожидал', 'ожидание', 'ожидалось', 'expected');
  const вышло = взять(о, 'gt', 'вышло', 'реальность', 'получилось', 'reality');
  if (!ждал || !вышло) return '';
  const ещё = хвостик(прочееМеток(value, ['xp', 'ожидал', 'ожидание', 'ожидалось', 'expected', 'gt', 'вышло', 'реальность', 'получилось', 'reality']));
  if (вид === 'split') {
    // Разлом: мечтательная половина в искрах и облаках, реальная — резкая,
    // между ними зубчатая трещина.
    const искры = Array.from({ length: 9 }, (_, k) => `<i style="--x:${(k * 37) % 90 + 4}%;--y:${(k * 53) % 80 + 8}%;--i:${k}"></i>`).join('');
    return обёртка('exp', 'split', `<div class="dream"><span class="sp" aria-hidden="true">${искры}</span><small><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 17h11a4 4 0 0 0 .4-8 6 6 0 0 0-11.4 1.5A3.4 3.4 0 0 0 6 17Z"/></svg>ожидание</small><p>${т(с1(ждал))}</p></div>`
      + `<div class="real"><small><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ИКОНКИ.bolt}"/></svg>реальность</small><p>${т(с1(вышло))}</p></div>${ещё}`);
  }
  if (вид === 'photos') {
    // Два полароида с маленькими сценами: мечта — закат со звёздами,
    // реальность — ночное окно под дождём; подписи от руки, скотч.
    const капли = Array.from({ length: 16 }, (_, k) => `<path d="M${(k * 13) % 100 + 4} ${(k * 29) % 50 + 4}l-2 7"/>`).join('');
    const id = новыйId('ph');
    return обёртка('exp', 'photos', `<figure class="was"><i class="tape" aria-hidden="true"></i><svg viewBox="0 0 100 64" aria-hidden="true"><defs><linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="d0"/><stop offset="1" class="d1"/></linearGradient></defs>`
      + `<rect width="100" height="64" fill="url(#${id}a)"/><circle class="sun" cx="68" cy="40" r="11"/><path class="hill" d="M0 52c20-10 40-6 56 0s30 4 44-4v16H0Z"/><path class="cloud" d="M14 22h22a6 6 0 0 0 0-12 9 9 0 0 0-17 2 5 5 0 0 0-5 10Z"/>`
      + `<g class="stars"><circle cx="40" cy="8" r=".8"/><circle cx="86" cy="12" r=".9"/><circle cx="56" cy="16" r=".6"/></g></svg><figcaption>как представлялось<b>${т(ждал)}</b></figcaption></figure>`
      + `<figure class="is"><i class="tape" aria-hidden="true"></i><svg viewBox="0 0 100 64" aria-hidden="true"><defs><linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="n0"/><stop offset="1" class="n1"/></linearGradient></defs>`
      + `<rect width="100" height="64" fill="url(#${id}b)"/><path class="frame" d="M50 0v64M0 32h100"/><path class="bolt" d="M70 4 62 20h6l-4 12 10-16h-6Z"/><g class="rain">${капли}</g><rect class="sill" y="58" width="100" height="6"/></svg>`
      + `<figcaption>как вышло<b>${т(вышло)}</b></figcaption><span class="date" aria-hidden="true">сегодня</span></figure>${ещё}`);
  }
  if (вид === 'arrow') {
    // Стрелочный перевод: путь раздваивается; к ожиданию — бледная
    // перечёркнутая ветка, к реальности — горящая.
    return обёртка('exp', 'arrow', `<svg class="rail" viewBox="0 0 90 110" aria-hidden="true"><path class="ties" d="M6 52h12M6 58h12M20 47l10 6M24 63l10-4"/>`
      + `<path class="track" d="M0 55h22"/><path class="ghost" d="M22 55C46 55 52 18 88 18"/><path class="live" d="M22 55C46 55 52 92 88 92"/><path class="x" d="M58 22l10 10M68 22 58 32"/>`
      + `<g class="lever"><circle cx="22" cy="55" r="5"/><path d="M22 55l6-10"/><circle cx="28" cy="45" r="2.2"/></g></svg>`
      + `<div class="ends"><p class="was"><small>ожидание</small>${т(с1(ждал))}</p><p class="is"><small>реальность</small>${т(с1(вышло))}</p>${ещё}</div>`);
  }
  return '';
}

/* ================================= ЦЕЛИ =================================== */

function разобратьЦели(value) {
  const о = метки(value);
  const ц = [['Сейчас', взять(о, 'nw', 'сейчас', 'now')], ['Скоро', взять(о, 'sn', 'скоро', 'soon')], ['Когда-нибудь', взять(о, 'lt', 'будущее', 'потом', 'когда-нибудь', 'later', 'мечта')]].filter(([, x]) => x);
  if (ц.length) {
    for (const x of прочееМеток(value, ['nw', 'сейчас', 'now', 'sn', 'скоро', 'soon', 'lt', 'будущее', 'потом', 'когда-нибудь', 'later', 'мечта'])) {
      const m = x.match(/^\s*([^:：]{1,20})[:：]\s*(.+)$/);
      ц.push(m ? [с1(m[1]), m[2]] : ['Ещё', x]);
    }
    return ц;
  }
  return куски(value).slice(0, 5).map((x, i) => [['Сейчас', 'Скоро', 'Потом', 'Позже', 'Мечта'][i], x]);
}
function видЦелей(value, вид) {
  const ц = разобратьЦели(value);
  if (!ц.length) return '';
  if (вид === 'ladder') {
    // Ступени в объёме: на нижней — человечек, на верхней — флаг.
    const n = ц.length;
    return обёртка('goals', 'ladder', `<div class="stairs">${ц.map(([когда, что], i) => `<div class="step" style="--i:${i};--n:${n}">`
      + (i === 0 ? `<svg class="me" viewBox="0 0 24 26" aria-hidden="true"><path d="${СИЛУЭТ}"/></svg>` : '')
      + (i === n - 1 ? `<svg class="flag" viewBox="0 0 24 30" aria-hidden="true"><path class="pole" d="M5 2v28"/><path class="cloth" d="M5 3h15l-4 5 4 5H5Z"/></svg>` : '')
      + `<span class="face"><small>${когда}</small>${т(с1(что))}</span></div>`).join('')}</div>`);
  }
  if (вид === 'target') {
    // Мишень лучника и дротики: «сейчас» — в золото, остальные дальше.
    const кольца = [[46, 'w'], [38, 'k'], [30, 'b'], [22, 'r'], [13, 'g']];
    const места = [[50, 50, -40], [62, 33, -25], [32, 70, -60], [70, 66, -15], [28, 34, -50]];
    const дротик = ([x, y, a], i) => `<g class="dart d${i}" transform="translate(${x} ${y}) rotate(${a})"><path class="shaft" d="M0 0h26"/><path class="fl" d="M20 0l8-5h3l-4 5 4 5h-3Z"/><circle class="hit" r="1.6"/></g>`;
    return обёртка('goals', 'target', `<svg class="board" viewBox="0 0 100 100" aria-hidden="true"><circle class="stand" cx="50" cy="50" r="49"/>${кольца.map(([r, к]) => `<circle class="ring ${к}" cx="50" cy="50" r="${r}"/>`).join('')}`
      + `<path class="tick" d="M50 4v8M50 88v8M4 50h8M88 50h8"/>${ц.map((_, i) => дротик(места[i], i)).join('')}</svg>`
      + `<ol>${ц.map(([когда, что], i) => `<li class="d${i}"><i aria-hidden="true"></i><span><small>${когда}</small>${т(с1(что))}</span></li>`).join('')}</ol>`);
  }
  if (вид === 'road') {
    // Карта пути: извилистая дорога, ёлки и горы, булавки с номерами,
    // в конце — звёздный флаг. Подписи под картой.
    const n = ц.length, xs = ц.map((_, i) => 30 + i * (260 / Math.max(1, n - 1)));
    const y = (x) => 60 + Math.sin((x - 30) / 260 * Math.PI * 2.2) * 26;
    let дорога = `M0 ${ф(y(0))}`; for (let x = 10; x <= 320; x += 10) дорога += ` L${x} ${ф(y(x))}`;
    const ёлки = [[60, 18], [96, 96], [150, 20], [214, 100], [270, 24], [18, 100]].map(([x, yy]) => `<path class="tree" d="M${x} ${yy - 10}l6 10h-4l5 8H${x - 5}l5-8h-4Z"/>`).join('');
    return обёртка('goals', 'road', `<svg class="map" viewBox="0 0 320 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><rect class="land" width="320" height="120" rx="12"/>`
      + `<path class="mount" d="M110 40l16-26 10 14 8-10 18 22Z"/><path class="snow" d="M126 14l5 8-5-2-4 3Z"/>${ёлки}`
      + `<path class="road" d="${дорога}"/><path class="mid" d="${дорога}"/>`
      + xs.map((x, i) => `<g class="stop s${i}${i === n - 1 ? ' is-end' : ''}" transform="translate(${ф(x)} ${ф(y(x))})"><ellipse class="sh" cy="1" rx="5" ry="1.6"/>${i === n - 1 ? '<path class="pole" d="M0 0V-26"/><path class="banner" d="M0-26h16l-4 5 4 5H0Z"/>' : `<path class="pin" d="M0 0s-8-8.4-8-14a8 8 0 0 1 16 0c0 5.6-8 14-8 14Z"/><text y="-11.4">${i + 1}</text>`}</g>`).join('')
      + `</svg><ol class="legend">${ц.map(([когда, что], i) => `<li><b>${i === n - 1 ? '★' : i + 1}</b><span><small>${когда}</small>${т(с1(что))}</span></li>`).join('')}</ol>`);
  }
  return '';
}

/* ============================== РАСПИСАНИЕ ================================ */

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
    // Отрывной календарь: корешок с кольцами, под листом — стопка, низ рваный.
    return обёртка('sched', 'calendar', с.map((x, i) => `<div class="pad" style="--i:${i}"><i class="spine" aria-hidden="true"><s></s><s></s><s></s></i>`
      + `<div class="leaf"><span class="day">${т(x.день || 'в течение дня')}</span><b class="big">${т(x.время || '—')}</b><span class="what">${т(с1(x.что))}</span></div><i class="stack" aria-hidden="true"></i></div>`).join(''));
  }
  if (вид === 'planner') {
    // Ежедневник: кожаная обложка со строчкой, ленточка-закладка, лист с полями.
    return обёртка('sched', 'planner', `<div class="cover"><i class="ribbon" aria-hidden="true"></i><div class="page"><span class="head">План<em>${т(с[0].день || 'на ближайшее')}</em></span>`
      + с.map(x => `<div class="line"><span class="when">${т(x.время || x.день || '·')}</span><span class="what">${т(с1(x.что))}</span><i class="ck" aria-hidden="true"></i></div>`).join('') + `</div></div>`);
  }
  if (вид === 'tickets') {
    // Входные билеты: шапка, поля «день / время / №», голографическая полоса,
    // перфорация и корешок со штрихкодом.
    return обёртка('sched', 'tickets', с.map((x, i) => `<div class="tk" style="--h:${(i * 97) % 300 - 150}"><div class="main"><span class="head">Входной билет<i class="holo" aria-hidden="true"></i></span>`
      + `<b class="ev">${т(с1(x.что))}</b><span class="fields"><span><small>день</small>${т(x.день || '—')}</span><span><small>время</small>${т(x.время || '—')}</span><span><small>№</small>${String(i + 1).padStart(3, '0')}</span></span></div>`
      + `<div class="stub" aria-hidden="true"><span class="code"></span><small>${т(x.время || '—')}</small></div></div>`).join(''));
  }
  return '';
}

/* ============================== ФЛАГ-МОНИТОР ============================== */

function видФлагов(value, вид) {
  const в = String(value || '').split(/;|\n/).map(x => x.trim()).filter(x => x && !пусто(x));
  if (!в.length) return '';
  if (вид === 'checklist') {
    // Лист в клетку: заголовок от руки, рисованные квадратики, маркер-выделение.
    return обёртка('flags', 'checklist', `<div class="grid"><b class="ttl">Не забыть:</b><ul>${в.map((x, i) => `<li style="--i:${i}"><svg class="box" viewBox="0 0 20 20" aria-hidden="true"><path d="M3.4 3.8c4-.6 9-.4 13.2-.2.6 4 .4 8.6.2 12.8-4 .6-9 .4-13.2.2-.4-4.2-.6-8.6-.2-12.8Z"/></svg><span><mark>${т(с1(x))}</mark></span></li>`).join('')}</ul></div>`);
  }
  if (вид === 'pins') {
    // Доска детектива: пробка, карточки на кнопках, красная нить между ними.
    return обёртка('flags', 'pins', `<div class="cork">${в.map((x, i) => `<div class="card c${i % 3}" style="--r:${[-2.4, 1.6, -1, 2.2, -1.8][i % 5]}deg;--i:${i}"><i class="pin" aria-hidden="true"></i><span>${т(с1(x))}</span></div>`).join('')}</div>`);
  }
  if (вид === 'lamps') {
    // Закладки в книге: обрез страниц слева, из него торчат цветные
    // язычки-закладки с текстом, каждая своего оттенка темы.
    return обёртка('flags', 'lamps', `<div class="book"><i class="pages" aria-hidden="true"></i><div class="tabs">${в.map((x, i) => `<span class="tab" style="--h:${(i * 53) % 260 - 130};--i:${i}">${т(с1(x))}</span>`).join('')}</div></div>`);
  }
  return '';
}

/* ========================== ГЛУБИНА КОНФЛИКТА ============================= */

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
  const кл = ст >= 0 ? СТАДИИ[ст][0] : 'brewing';
  const ещё = хвостик(прочееМеток(value, ['wy', 'причина', 'why', 'dys', 'дней', 'days', 'sg', 'стадия', 'stage']));
  const днейТекст = Number.isFinite(дней) ? `${дней} ${дней % 10 === 1 && дней % 100 !== 11 ? 'день' : [2, 3, 4].includes(дней % 10) && ![12, 13, 14].includes(дней % 100) ? 'дня' : 'дней'}` : '';
  if (вид === 'stages') {
    // Шкала эскалации: четыре цветных отрезка, над текущим — стрелка с
    // днями; причина — в облачке со значком молнии.
    return обёртка('conflict', 'stages', `<div class="scale">${СТАДИИ.map(([к, имя], i) => `<span class="seg st-${к}${i === ст ? ' is-now' : ''}">${i === ст ? `<i class="needle" aria-hidden="true">${днейТекст ? `<b>${днейТекст}</b>` : ''}</i>` : ''}<small>${имя}</small></span>`).join('')}</div>`
      + (причина ? `<p class="why"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ИКОНКИ.bolt}"/></svg>${т(с1(причина))}</p>` : '') + ещё);
  }
  if (вид === 'counter') {
    // Перекидной счётчик: цифры на половинках с петлёй посередине.
    const цифры = String(Number.isFinite(дней) ? дней : 0).padStart(2, '0').split('');
    return обёртка('conflict', 'counter', `<div class="flip">${цифры.map(d => `<span class="digit"><i class="up">${d}</i><i class="dn">${d}</i><s aria-hidden="true"></s></span>`).join('')}<small>${днейТекст ? днейТекст.replace(/^\d+\s*/, '') : 'дней'}<br>в ссоре</small></div>`
      + `<div class="info"><em class="chip st-${кл}">${т(слово)}</em>${причина ? `<p>${т(с1(причина))}</p>` : ''}${ещё}</div>`);
  }
  if (вид === 'weather') {
    // Погода между ними: у каждой стадии своё небо и своя картинка.
    const сцена = {
      brewing: '<path class="cl c1" d="M20 54h50a14 14 0 0 0 0-28 20 20 0 0 0-38 4 12 12 0 0 0-12 24Z"/><path class="cl c2" d="M120 46h46a12 12 0 0 0 0-24 18 18 0 0 0-34 4 10 10 0 0 0-12 20Z"/><path class="wind" d="M60 72h60c8 0 8-10 0-10M80 82h70c8 0 8 10 0 10"/>',
      open: '<path class="cl dark c1" d="M14 50h70a16 16 0 0 0 0-32 24 24 0 0 0-46 5 14 14 0 0 0-24 27Z"/><path class="cl dark c2" d="M110 44h66a14 14 0 0 0 0-28 22 22 0 0 0-42 4 12 12 0 0 0-24 24Z"/><path class="bolt" d="M60 50 48 74h10l-6 22 18-28H60l6-18Z"/><path class="bolt b2" d="M150 44l-8 16h7l-4 14 12-19h-7l4-11Z"/><g class="rain">' + Array.from({ length: 18 }, (_, k) => `<path d="M${10 + k * 11} ${60 + (k % 3) * 8}l-4 10"/>`).join('') + '</g>',
      cold: '<path class="cl ice c1" d="M30 50h60a14 14 0 0 0 0-28 20 20 0 0 0-40 4 12 12 0 0 0-20 24Z"/><g class="flake">' + [[40, 74], [80, 84], [120, 70], [160, 82], [100, 96]].map(([x, y]) => `<path d="M${x} ${y - 6}v12M${x - 5} ${y - 3}l10 6M${x + 5} ${y - 3}l-10 6"/>`).join('') + '</g><path class="icicle" d="M0 0h200v6c-6 0-6 12-10 12s-4-12-10-12-6 18-10 18-4-18-10-18-6 8-10 8-4-8-10-8-6 14-10 14-4-14-10-14-6 10-10 10-4-10-10-10-6 16-10 16-4-16-10-16-6 8-10 8-4-8-10-8-6 12-10 12-4-12-10-12-6 6-10 6-4-6-10-6-6 14-10 14-4-14-10-14-6 8-10 8-4-8-10-8Z"/>',
      peace: '<path class="rainbow r1" d="M30 100a70 70 0 0 1 140 0"/><path class="rainbow r2" d="M38 100a62 62 0 0 1 124 0"/><path class="rainbow r3" d="M46 100a54 54 0 0 1 108 0"/><circle class="sun" cx="140" cy="46" r="16"/><path class="rays" d="M140 20v-8M162 30l6-6M168 46h8M118 30l-6-6"/><path class="cl soft c1" d="M40 70h56a13 13 0 0 0 0-26 18 18 0 0 0-34 4 11 11 0 0 0-22 22Z"/>',
    }[кл];
    return обёртка('conflict', 'weather', `<div class="sky st-${кл}"><svg viewBox="0 0 200 104" preserveAspectRatio="xMidYMin slice" aria-hidden="true">${сцена}</svg>`
      + `<div class="cap"><b>${т(с1(слово))}</b>${днейТекст ? `<small>${днейТекст}</small>` : ''}${причина ? `<p>${т(с1(причина))}</p>` : ''}${ещё}</div></div>`);
  }
  return '';
}

/* ================================ РЕПЛИКИ ================================= */

function видРеплик(value, вид, имя = '') {
  const в = String(value || '').split(/[;\n]/).map(x => x.trim().replace(/^[«"'`“„]+|[»"'`”]+$/g, '').trim()).filter(x => x && !пусто(x));
  if (!в.length) return '';
  const кто = String(имя || '').trim().split(/\s+/)[0] || '';
  if (вид === 'quotes') {
    // Цитаты-открытки: большие кавычки градиентом, чередование сторон, подпись.
    const id = новыйId('qt');
    return обёртка('lines', 'quotes', в.map((x, i) => `<figure class="${i % 2 ? 'r' : 'l'}" style="--i:${i}"><svg class="qm" viewBox="0 0 40 30" aria-hidden="true"><defs><linearGradient id="${id}${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="q0"/><stop offset="1" class="q1"/></linearGradient></defs><path fill="url(#${id}${i})" d="M2 28V17C2 8 7 3 15 1l2 4c-5 2-7 5-7 9h7v14Zm21 0V17c0-9 5-14 13-16l2 4c-5 2-7 5-7 9h7v14Z"/></svg>`
      + `<blockquote>${т(x)}</blockquote>${кто ? `<figcaption>— ${т(кто)}</figcaption>` : ''}</figure>`).join(''));
  }
  if (вид === 'script') {
    // Голосовые: кнопка, волна из столбиков (своя у каждой фразы),
    // длительность по длине фразы и расшифровка под ней.
    const буква = т((кто || '?').charAt(0).toUpperCase());
    return обёртка('lines', 'script', в.map((x, i) => {
      const r = генератор(x), сек = Math.max(2, Math.round(x.length / 9));
      const столбики = Array.from({ length: 28 }, (_, k) => `<i style="--v:${ф(.25 + r() * .75 * (k > 2 && k < 25 ? 1 : .5))}"></i>`).join('');
      return `<div class="vm" style="--i:${i}"><span class="ava" aria-hidden="true">${буква}</span><div class="bub"><span class="row"><i class="play" aria-hidden="true"></i><span class="wave" aria-hidden="true">${столбики}</span><small>0:${String(сек).padStart(2, '0')}</small></span><p>${т(x)}</p></div></div>`;
    }).join(''));
  }
  if (вид === 'subtitles') {
    // Кадр фильма: размытый свет боке, чёрные поля, тайм-коды и субтитры.
    const r = генератор(value);
    const боке = Array.from({ length: 10 }, () => `<i style="--x:${ф(r() * 100)}%;--y:${ф(10 + r() * 60)}%;--s:${ф(14 + r() * 36)}px;--o:${ф(.15 + r() * .35)}"></i>`).join('');
    let сек = зерно(value) % 2400 + 60;
    const код = () => { сек += 4 + (сек % 7); const m = Math.floor(сек / 60), s = сек % 60; return `00:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
    return обёртка('lines', 'subtitles', `<div class="frame"><span class="bokeh" aria-hidden="true">${боке}</span><i class="bar t" aria-hidden="true"></i><i class="bar b" aria-hidden="true"></i><span class="badge" aria-hidden="true">CC</span>`
      + `<div class="subs">${в.map((x, i) => `<p style="--i:${i}"><small aria-hidden="true">${код()}</small><span>${кто ? `<em>${т(кто)}:</em> ` : ''}${т(x)}</span></p>`).join('')}</div></div>`);
  }
  return '';
}

/* ============================== ОБЩИЙ ВХОД ================================ */

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
