// hud-manager/render/phone-apps.js
//
// «Контакты», «Поиск» и «Карты» — три экрана телефона в облике настоящих
// приложений. Данные те же, что пишет модель (phn.ct, phn.sq, phn.mp), плюс
// то, что уже есть в HUD: с кем идёт переписка, где сейчас владелец.
//
//   Контакты — по алфавиту с буквами-разделами, своя карточка сверху,
//              «Избранное» — те, с кем есть переписка (касание открывает чат),
//              строка раскрывается: заметка, ложное имя, «Написать».
//   Поиск    — строка поиска, ярлыки, недавние запросы одним списком.
//   Карты    — нарисованный город (кварталы под углом, река, парки, проспект),
//              булавки по типу места, «Вы здесь», лист снизу со списком.
//              Касание места в списке поднимает его булавку и прокладывает
//              к нему путь по улицам — без JS, через :has(:focus).
//
// Схема города выводится из названий мест: одно и то же место всегда на
// одной и той же точке. Это набросок, а не навигатор.

import { escapeHtml, defeatWI, hudHashSeed } from '../utils.js?v=23.90.15';
import { английский } from '../i18n.js?v=23.90.15';
import { namesLikelySame } from '../names.js?v=23.90.15';
import { G_ICONS } from './icons.js?v=23.90.15';
import { контактСНастоящимИменем, ложноеИмяHTML, меткаЛожногоИмени } from './phone-common.js?v=23.90.15';
import { лицо } from './phone-extra.js?v=23.90.15';

const текст = (v) => (v === null || v === undefined ? '' : String(v)).trim();
const пусто = (v) => !текст(v) || /^(empty|none|null|нет|пусто)$/i.test(текст(v));
const пустойЭкран = (icon, text) => `<div class="hud-phone-empty-app"><div class="hud-phone-empty-icon">${icon}</div><div class="hud-phone-empty-line">${escapeHtml(text)}</div></div>`;
const склон = (n, [один, два, пять]) => { const к = Math.abs(n) % 100, е = к % 10; return к > 10 && к < 20 ? пять : е === 1 ? один : е >= 2 && е <= 4 ? два : пять; };

// Штриховые значки этих экранов: 24×24, линия currentColor.
const ико = (тело, класс = '') => `<svg class="hud-pa-ico${класс ? ' ' + класс : ''}" viewBox="0 0 24 24" aria-hidden="true">${тело}</svg>`;
const И = {
  chev: ико('<path d="m9.5 6 6 6-6 6"/>'),
  chat: ико('<path d="M20 11.6c0 4-3.6 7-8 7-1.2 0-2.3-.2-3.3-.6L4 19.5l1.3-3.7C4.5 14.6 4 13.2 4 11.6c0-4 3.6-7 8-7s8 3 8 7z"/>'),
  glass: ико('<circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.6 15.6 4.4 4.4"/>'),
  mic: ико('<rect x="9.2" y="3.5" width="5.6" height="10.5" rx="2.8"/><path d="M6 11.2a6 6 0 0 0 12 0M12 17.2v3.3"/>'),
  lens: ико('<path d="M4 9V6.5A2.5 2.5 0 0 1 6.5 4H9M15 4h2.5A2.5 2.5 0 0 1 20 6.5V9M20 15v2.5a2.5 2.5 0 0 1-2.5 2.5H15M9 20H6.5A2.5 2.5 0 0 1 4 17.5V15"/><circle cx="12" cy="12" r="3.2"/>'),
  clock: ико('<circle cx="12" cy="12" r="8"/><path d="M12 7.6V12l3 1.9"/>'),
  fill: ико('<path d="M17.5 17.5 7 7M7 14.5V7h7.5"/>'),
  image: ико('<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4.5 3.5 3 3-2.5 4.5 4"/>'),
  translate: ико('<path d="M4 6.5h9M8.5 4.5v2M6.2 6.5c.6 2.8 2.6 5.2 5.3 6.6"/><path d="M11 6.5c-.7 3.3-3 6.1-6.4 7.6"/><path d="m13.2 20 3.4-8 3.4 8M14.4 17.4h4.4"/>'),
  music: ико('<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.8" cy="17.5" r="2.3"/><circle cx="16.8" cy="15.5" r="2.3"/>'),
  pin: ико('<path d="M12 20.5s6.5-5.6 6.5-10.8a6.5 6.5 0 0 0-13 0c0 5.2 6.5 10.8 6.5 10.8z"/><circle cx="12" cy="9.8" r="2.4"/>'),
  locate: ико('<path d="M19.5 4.5 4.5 11l6.8 1.7 1.7 6.8z"/>'),
  layers: ико('<path d="m12 4 8.5 4.5L12 13 3.5 8.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5"/>'),
  route: ико('<path d="M12 3.5 20.5 12 12 20.5 3.5 12z"/><path d="M9.5 13.5v-2a1 1 0 0 1 1-1h4M13 8.5l2 2-2 2"/>'),
  person: ико('<circle cx="12" cy="8.5" r="3.8"/><path d="M4.8 20c.9-3.6 3.7-5.5 7.2-5.5s6.3 1.9 7.2 5.5"/>'),
};

// =============================================================================
// Контакты
// =============================================================================

// Буква раздела: первая буква имени; цифры, значки и эмодзи — под «#».
const буква = (имя) => {
  const б = (текст(имя).match(/\p{L}/u) || [''])[0].toLocaleUpperCase('ru');
  return б && /^\p{L}/u.test(текст(имя)) ? б : '#';
};

/**
 * @param contacts — phone.contacts: [{ name, note, realName }]
 * @param доп — { владелец, чаты: [{ имя, цель }] }
 */
export function buildContactsApp(contacts, { владелец = '', чаты = [] } = {}) {
  const список = (Array.isArray(contacts) ? contacts : []).filter(c => c && !пусто(c.name));
  if (!список.length) return пустойЭкран(G_ICONS.person, 'Список контактов пуст');

  // Переписка с контактом: по имени в телефоне или по настоящему имени.
  const чатС = (c) => {
    const имена = [c.name, c.realName].map(текст).filter(Boolean);
    return (чаты.find(ч => имена.some(и => namesLikelySame(и, ч.имя))) || {}).цель || '';
  };
  const люди = список.map(c => {
    const имя = текст(c.name);
    const личность = контактСНастоящимИменем(список, имя);
    return { имя, заметка: пусто(c.note) ? '' : текст(c.note), личность, чат: чатС(c) };
  });

  const своя = текст(владелец) ? `<div class="hud-pc-me">${лицо(текст(владелец), 'hud-pc-me-ava')}<span class="hud-pc-me-txt"><b data-i18n-skip>${defeatWI(escapeHtml(текст(владелец)))}</b><span>Моя карточка</span></span></div>` : '';

  // Избранное — с кем переписка, в порядке свежести чатов (как их отдал вызывающий).
  const избранные = [];
  for (const ч of чаты) {
    const ч_ = люди.find(л => л.чат === ч.цель);
    if (ч_ && !избранные.includes(ч_)) избранные.push(ч_);
    if (избранные.length === 4) break;
  }
  const избранное = избранные.length ? `<div class="hud-pc-h">Избранное</div><div class="hud-pc-favs" style="--n:${избранные.length}">${избранные.map(л =>
    `<button type="button" class="hud-pc-fav hud-pc-msg" data-chat-target="${escapeHtml(л.чат)}" title="${escapeHtml(л.имя)}">${лицо(л.имя, 'hud-pc-fav-ava')}<span class="hud-pc-fav-dot">${И.chat}</span><span class="hud-pc-fav-name" data-i18n-skip>${defeatWI(escapeHtml(л.личность && !л.личность.ложное ? л.имя : л.имя.split(/\s+/)[0]))}</span></button>`).join('')}</div>` : '';

  // б — буква раздела у первого контакта на неё (столбик слева, как в Android), иначе пусто.
  // Касание строки — она «всплывает», как пилюли в карточке (events.js,
  // ОЖИВАЮТ_ПО_КАСАНИЮ → fx-tap): поднимается, светится и показывает заметку целиком.
  // Кнопка чата — только там, где переписка есть, и она её открывает.
  const строка = (л, б) => {
    const ложное = л.личность && л.личность.ложное;
    const полное = л.личность && !ложное ? `<span class="hud-pc-sub hud-contact-full" data-i18n-skip>${defeatWI(escapeHtml(л.личность.настоящее))}</span>` : '';
    const заметка = л.заметка ? `<span class="hud-pc-sub hud-pc-note">${escapeHtml(л.заметка)}</span>` : '';
    const чат = л.чат ? `<button type="button" class="hud-pc-go hud-pc-msg" data-chat-target="${escapeHtml(л.чат)}" title="Написать">${И.chat}</button>` : '';
    return `<div class="hud-pc-row${б ? ' is-first' : ''}"><span class="hud-pc-l" data-i18n-skip>${escapeHtml(б)}</span>${лицо(л.имя, 'hud-pc-ava')}<span class="hud-pc-txt"><b data-i18n-skip>${ложное ? меткаЛожногоИмени() : ''}${defeatWI(escapeHtml(л.имя))}</b>${полное}${заметка}${ложное ? ложноеИмяHTML(л.личность) : ''}</span>${чат}</div>`;
  };

  // По алфавиту, как в любой адресной книге; «#» — в конце.
  const порядок = [...люди].sort((a, b) => {
    const ба = буква(a.имя), бб = буква(b.имя);
    if ((ба === '#') !== (бб === '#')) return ба === '#' ? 1 : -1;
    return a.имя.localeCompare(b.имя, 'ru', { sensitivity: 'base' });
  });
  const тело = порядок.map((л, i) => строка(л, i && буква(порядок[i - 1].имя) === буква(л.имя) ? '' : буква(л.имя))).join('');
  const n = люди.length;
  const итог = английский() ? `${n} ${n === 1 ? 'contact' : 'contacts'}` : `${n} ${склон(n, ['контакт', 'контакта', 'контактов'])}`;

  return `<div class="hud-pc">
    <div class="hud-pa-find" aria-hidden="true">${И.glass}<span>Поиск</span>${И.mic}</div>
    ${своя}${избранное}
    <div class="hud-pc-list">${тело}</div>
    <div class="hud-pc-total" data-i18n-skip>${итог}</div>
  </div>`;
}

// =============================================================================
// Поиск
// =============================================================================

// Строка поиска и ярлыки — рисунок, как в приложении. Недавние запросы по
// касанию «всплывают», как пилюли в карточке (events.js → fx-tap).
export function buildSearchApp(search) {
  const запросы = (Array.isArray(search) ? search : []).map(текст).filter(q => q && !пусто(q));
  const строка = `<div class="hud-ps-bar" aria-hidden="true">${И.glass}<span class="hud-ps-hint">Поиск в Google или URL</span><span class="hud-ps-tools"><span class="hud-ps-mic">${И.mic}</span><span class="hud-ps-lens">${И.lens}</span></span></div>`;
  const ярлык = (ико, подпись, тон) => `<span class="hud-ps-tile" style="--t:${тон}"><span class="hud-ps-tile-i">${ико}</span><span class="hud-ps-tile-l">${подпись}</span></span>`;
  const ярлыки = `<div class="hud-ps-tiles" aria-hidden="true">${ярлык(И.image, 'Картинки', '#5b9cf5')}${ярлык(И.translate, 'Перевод', '#4fc28a')}${ярлык(И.music, 'Музыка', '#e46aa8')}${ярлык(И.pin, 'Места', '#f0a03c')}</div>`;
  if (!запросы.length) return `<div class="hud-ps">${строка}${ярлыки}</div>` + пустойЭкран(G_ICONS.clock, 'История поиска пуста');
  return `<div class="hud-ps">${строка}${ярлыки}
    <div class="hud-ps-head"><span>Недавние</span><span>${запросы.length}</span></div>
    <div class="hud-ps-list">${запросы.map((q, i) => `<div class="hud-ps-row${i ? '' : ' is-last'}"><span class="hud-ps-clock">${И.clock}</span><span class="hud-ps-q" data-i18n-skip>${escapeHtml(q)}</span><span class="hud-ps-fill">${И.fill}</span></div>`).join('')}</div>
  </div>`;
}

// =============================================================================
// Карты
// =============================================================================

function случай(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Тип места — по названию и заметке: значок и цвет булавки, как в настоящих картах.
const ТИПЫ = [
  ['home', /(?:^|[^\p{L}])(?:дом|домой|квартир\p{L}*|home|apartment|flat)(?![\p{L}])/iu, '#4aa8d8', '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/><path d="M10 19v-5h4v5"/>'],
  ['bar', /(?:^|[^\p{L}])(?:бар|паб|клуб|pub|bar|club|lounge)(?![\p{L}])/iu, '#d6589e', '<path d="M5 5h14l-7 8z"/><path d="M12 13v6M8.5 19.5h7"/>'],
  ['food', /кафе|кофе|кофейн|ресторан|столов|пицц|пекарн|шаурм|бургер|суши|закусоч|cafe|café|coffee|restaurant|diner|pizza|bakery|burger/iu, '#f0913a', '<path d="M5 9h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8.5 3.5c-.6 1 .6 1.8 0 3M11.5 3.5c-.6 1 .6 1.8 0 3"/>'],
  ['health', /больниц|клиник|поликлин|аптек|травмпункт|госпитал|врач|hospital|clinic|pharmacy|doctor|\bER\b/iu, '#e5535e', '<path d="M9.5 4.5h5v5h5v5h-5v5h-5v-5h-5v-5h5z"/>'],
  ['study', /школ|универ|институт|колледж|академи|лицей|гимнази|библиотек|school|universit|college|academy|campus|library/iu, '#9a72e8', '<path d="M2.5 9.5 12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5V16c1.5 1.6 3.3 2.3 5.5 2.3s4-.7 5.5-2.3v-4.5M21.5 9.5v5"/>'],
  ['park', /парк|сквер|(?:^|[^\p{L}])сад(?![\p{L}])|лес|пляж|набережн|озер|park|garden|beach|forest|lake/iu, '#43b56b', '<path d="M12 3.5c3 0 5 2.4 5 5.2 2 .6 3 2.2 3 4 0 2.6-2.2 4.3-4.8 4.3H8.8C6.2 17 4 15.3 4 12.7c0-1.8 1-3.4 3-4 0-2.8 2-5.2 5-5.2z"/><path d="M12 10v10.5"/>'],
  ['shop', /магазин|(?:^|[^\p{L}])тц(?![\p{L}])|торгов|рынок|супермаркет|бутик|mall|shop|store|market|boutique/iu, '#3f8ef0', '<path d="M5 8h14l-1 12H6z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>'],
  ['transit', /вокзал|аэропорт|станци|метро|остановк|автобус|порт|station|airport|metro|subway|terminal|harbou?r/iu, '#5a8cf7', '<rect x="6" y="3.5" width="12" height="13" rx="3"/><path d="M6 10.5h12M8.5 16.5l-2 4M15.5 16.5l2 4"/>'],
  ['work', /офис|работ|завод|контор|склад|студи|офис|office|work|factory|warehouse|studio/iu, '#b08356', '<rect x="3.5" y="7.5" width="17" height="11.5" rx="2"/><path d="M9 7.5V5.8c0-.7.6-1.3 1.3-1.3h3.4c.7 0 1.3.6 1.3 1.3v1.7M3.5 12.5h17"/>'],
];
const ИМЕНА_ТИПОВ = { home: 'Дом', bar: 'Бары', food: 'Еда', health: 'Здоровье', study: 'Учёба', park: 'Парки', shop: 'Покупки', transit: 'Транспорт', work: 'Работа', star: 'Другое' };
const ЗВЕЗДА = '<path d="m12 4.5 2.3 4.8 5.2.6-3.9 3.6 1.1 5.1L12 16.1l-4.7 2.5 1.1-5.1-3.9-3.6 5.2-.6z"/>';
const типМеста = (имя, заметка) => {
  for (const [id, re, цвет, путь] of ТИПЫ) if (re.test(имя)) return { id, цвет, путь };
  for (const [id, re, цвет, путь] of ТИПЫ) if (re.test(заметка)) return { id, цвет, путь };
  return { id: 'star', цвет: '', путь: ЗВЕЗДА };
};

const ф = (v) => Number(v).toFixed(1);

export function buildMapsApp(maps, место, uid = '') {
  const точки = (Array.isArray(maps) ? maps : []).filter(m => m && !пусто(m.place || m.title));
  const здесь = пусто(место) ? '' : текст(место);
  if (!точки.length && !здесь) return пустойЭкран(G_ICONS.map, 'Нет сохранённых мест');

  const W = 300, H = 300, cx = W / 2, cy = H / 2;
  const r = случай(hudHashSeed(точки.map(m => m.place || m.title).join('|') || здесь));
  // Сетка улиц под углом: город редко стоит строго по сторонам света.
  const угол = -6 - r() * 16, рад = угол * Math.PI / 180;
  const xs = [], ys = [];
  for (let x = -90 + r() * 20; x < W + 90; x += 44 + r() * 30) xs.push(x);
  for (let y = -90 + r() * 20; y < H + 90; y += 34 + r() * 22) ys.push(y);
  // Кварталы между улицами; часть — парки и площади.
  const УЛ = 5.5;
  const парки = new Set();
  const кварталы = [];
  for (let i = 0; i + 1 < xs.length; i++) for (let j = 0; j + 1 < ys.length; j++) {
    const ключ = i + ':' + j;
    const x = xs[i] + УЛ / 2, y = ys[j] + УЛ / 2, w = xs[i + 1] - xs[i] - УЛ, h = ys[j + 1] - ys[j] - УЛ;
    const парк = r() < .12;
    if (парк) парки.add(ключ);
    // Большой квартал иногда делится переулком — город не выглядит сеткой из клеток.
    if (!парк && w > 52 && r() < .5) {
      const д = w * (.4 + r() * .2);
      кварталы.push(`<rect class="b" x="${ф(x)}" y="${ф(y)}" width="${ф(д - 2)}" height="${ф(h)}" rx="2.5"/><rect class="b" x="${ф(x + д + 1)}" y="${ф(y)}" width="${ф(w - д - 1)}" height="${ф(h)}" rx="2.5"/>`);
    } else кварталы.push(`<rect class="${парк ? 'p' : 'b'}" x="${ф(x)}" y="${ф(y)}" width="${ф(w)}" height="${ф(h)}" rx="${парк ? 5 : 2.5}"/>`);
    if (парк) for (let k = 0; k < 4; k++) кварталы.push(`<circle class="t" cx="${ф(x + 6 + r() * (w - 12))}" cy="${ф(y + 6 + r() * (h - 12))}" r="${ф(1.8 + r() * 1.6)}"/>`);
  }
  // Проспекты — по одной улице вдоль и поперёк, шире и своим цветом.
  const пi = 1 + Math.floor(r() * Math.max(1, xs.length - 2)), пj = 1 + Math.floor(r() * Math.max(1, ys.length - 2));
  const проспекты = `M${ф(xs[пi])} -100 V${H + 100} M-100 ${ф(ys[пj])} H${W + 100}`;
  // Река — поперёк города, проспекты идут поверх неё мостами.
  const рекаY = 40 + r() * (H - 80);
  const река = `M-40 ${ф(рекаY)} C ${ф(W * .3)} ${ф(рекаY - 50 + r() * 100)}, ${ф(W * .65)} ${ф(рекаY - 50 + r() * 100)}, ${W + 40} ${ф(рекаY - 25 + r() * 50)}`;

  // Точки мест: по хэшу названия, с отступом от краёв и друг от друга.
  const занято = [];
  const поставить = (имя) => {
    const q = случай(hudHashSeed(имя));
    let x = 0, y = 0;
    for (let i = 0; i < 14; i++) {
      x = 40 + q() * (W - 80); y = 74 + q() * (H - 136);
      if (!занято.some(([a, b]) => Math.hypot(a - x, b - y) < 32)) break;
    }
    занято.push([x, y]);
    return [x, y];
  };
  const совпадает = (m) => здесь && (namesLikelySame(m.place || m.title, здесь) || здесь.toLowerCase().includes(текст(m.place || m.title).toLowerCase().split(/[«»",]/).filter(Boolean)[0] || '\u0000'));
  let тутУже = false;
  const места = точки.slice(0, 12).map((m, i) => {
    const имя = текст(m.place || m.title), заметка = пусто(m.note) ? '' : текст(m.note);
    const тут = !тутУже && совпадает(m);
    if (тут) тутУже = true;
    return { n: i + 1, имя, заметка, тут, тип: типМеста(имя, заметка), xy: поставить(имя) };
  });
  const я = здесь ? (места.find(м => м.тут) || { xy: поставить('здесь:' + здесь) }).xy : null;

  // Путь до места — по улицам сетки: в повёрнутой системе координат
  // ломаная идёт вдоль ближайших улиц, потом поворачивается вместе с городом.
  const вСетку = ([x, y]) => [cx + (x - cx) * Math.cos(-рад) - (y - cy) * Math.sin(-рад), cy + (x - cx) * Math.sin(-рад) + (y - cy) * Math.cos(-рад)];
  const ближайшая = (список, v) => список.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a, список[0]);
  const путь = (от, до) => {
    const [x1, y1] = вСетку(от), [x2, y2] = вСетку(до);
    const ул1 = ближайшая(ys, y1), ул2 = ближайшая(xs, x2);
    return `M${ф(x1)} ${ф(y1)} V${ф(ул1)} H${ф(ул2)} V${ф(y2)} H${ф(x2)}`;
  };
  const пути = я ? места.filter(м => !м.тут).map(м => `<path class="hud-pm-route" data-pin="${м.n}" pathLength="1" d="${путь(я, м.xy)}"/>`).join('') : '';

  const булавка = (м) => `<g class="hud-pm-pin${м.тут ? ' is-here' : ''}" data-pin="${м.n}" data-t="${м.тип.id}" transform="translate(${ф(м.xy[0])} ${ф(м.xy[1])})"${м.тип.цвет ? ` style="--pc:${м.тип.цвет}"` : ''}>
      <ellipse class="hud-pm-shadow" rx="5" ry="1.8"/><g class="hud-pm-drop"><path d="M0 0 C-2 -5 -9 -9 -9 -16.5 A9 9 0 0 1 9 -16.5 C9 -9 2 -5 0 0 Z"/><text y="-16.2">${м.n}</text></g></g>`;
  const svg = `<svg class="hud-pm-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect class="hud-pm-road" x="-10" y="-10" width="${W + 20}" height="${H + 20}"/>
    <g transform="rotate(${ф(угол)} ${cx} ${cy})">
      <g class="hud-pm-blocks">${кварталы.join('')}</g>
      <path class="hud-pm-river-bank" d="${река}"/><path class="hud-pm-river" d="${река}"/>
      <path class="hud-pm-ave-case" d="${проспекты}"/><path class="hud-pm-ave" d="${проспекты}"/>
      <g class="hud-pm-traffic"><path class="g" d="${проспекты}"/><path class="o" d="${проспекты}"/><path class="r" d="${проспекты}"/></g>
      ${пути}
    </g>
    ${места.map(булавка).join('')}
    ${я ? `<g class="hud-pm-me" transform="translate(${ф(я[0])} ${ф(я[1])})"><path class="hud-pm-beam" d="M0 0 L-9 -20 A22 22 0 0 1 9 -20 Z"/><circle class="hud-pm-pulse" r="12"/><circle class="hud-pm-dot" r="5"/></g>` : ''}
  </svg>`;

  const значок = (м) => `<span class="hud-pm-badge"${м.тип.цвет ? ` style="--pc:${м.тип.цвет}"` : ''}><svg class="hud-pa-ico" viewBox="0 0 24 24" aria-hidden="true">${м.тип.путь}</svg><span>${м.n}</span></span>`;
  const список = места.map(м => `<div class="hud-pm-row${м.тут ? ' is-here' : ''}" data-pin="${м.n}" data-t="${м.тип.id}" tabindex="0">${значок(м)}<span class="hud-pm-txt"><b data-i18n-skip>${defeatWI(escapeHtml(м.имя))}</b>${м.тут ? '<span class="hud-pm-tag">Вы здесь</span>' : ''}${м.заметка ? `<span>${defeatWI(escapeHtml(м.заметка))}</span>` : ''}</span>${м.тут ? '' : `<button type="button" class="hud-pm-go" title="Маршрут">${И.route}</button>`}</div>`).join('');
  // Фильтр по типу мест — чипы под строкой поиска (radio, без скриптов):
  // выбранный тип оставляет яркими свои булавки и строки.
  const г = 'hud-pm-' + (uid || hudHashSeed(места.map(м => м.имя).join('|')).toString(36));
  const типы = [...new Map(места.map(м => [м.тип.id, м.тип])).values()];
  const чип = (id, подпись, отмечен, цвет) => `<label class="hud-pm-chip" data-t="${id}"${цвет ? ` style="--pc:${цвет}"` : ''}><input type="radio" class="hud-pa-in" name="${г}-t"${отмечен ? ' checked' : ''}>${подпись}</label>`;
  const чипы = типы.length > 1 ? `<div class="hud-pm-chips">${чип('all', 'Все', true)}${типы.map(т => чип(т.id, ИМЕНА_ТИПОВ[т.id] || 'Другое', false, т.цвет)).join('')}</div>` : '';

  return `<div class="hud-pm">
    <div class="hud-pm-canvas">${svg}
      <div class="hud-pa-find hud-pm-find" aria-hidden="true">${И.glass}<span>Поиск здесь</span>${И.mic}</div>${чипы}
      <div class="hud-pm-ctl"><label class="hud-pm-layers" title="Пробки"><input type="checkbox" class="hud-pa-in">${И.layers}</label>${я ? `<label class="hud-pm-follow" title="Где я"><input type="checkbox" class="hud-pa-in" checked>${И.locate}</label>` : ''}</div>
    </div>
    <div class="hud-pm-sheet"><span class="hud-pm-grip"></span>
      ${здесь ? `<div class="hud-pm-here"><span class="hud-pm-here-ico">${И.locate}</span><span class="hud-pm-txt"><span>Вы здесь</span><b data-i18n-skip>${defeatWI(escapeHtml(здесь))}</b></span></div>` : ''}
      ${места.length ? `<div class="hud-pm-head"><span>Сохранённые</span><span>${места.length}</span></div><div class="hud-pm-list">${список}</div>` : ''}
    </div>
  </div>`;
}
