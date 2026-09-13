// hud-manager/render/character.js
//
// Домены «Персонаж» и «{{user}}»: карточки с аватаркой, строками параметров
// и правилами вёрстки (полноширинные / драматические / обрезаемые ключи).
// Вынесено из index.js без изменения поведения.

import { escapeHtml, applyTooltips, buildPillList, getSafeUserName, mapKey, flattenFieldValue, перевестиМетку, снятьЗаглушки, разбитьСписок } from '../utils.js?v=22.99.22';
import { isNewLoreItem, loreButtonHTML } from '../lore.js?v=22.99.22';
import { getAvatarUrl, getUserAvatarUrl } from '../avatars.js?v=22.99.22';
import { силаСтраха, стадияБолезни } from '../codes.js?v=22.99.22';
import { settings } from '../settings.js?v=22.99.22';
import { namesLikelySame } from '../names.js?v=22.99.22';
import { parseRelationList } from './relations-graph.js?v=22.99.22';

const FULL_WIDTH_KEYS = ['мысли', 'ключ', 'ожидание vs реальность', 'отношения', 'общие воспоминания', 'флаг-монитор', 'социальное разоблачение', 'детализация nsfw', 'отзыв о сексе', 'nsfw', 'сновидение', 'расписание', 'скрытый подтекст', 'последний секс', 'кинк', 'фетиш', 'никогда не сделает', 'не возбуждает', 'болезни и травмы', 'беременность'];

// Порядок строк в карточке. Раньше он зависел от того, в каком порядке
// модель перечислила поля, и «Кинк» мог оказаться где угодно. Ключи, не
// попавшие в список, дописываются после в исходном порядке.
const FIELD_ORDER = ['Имя', 'Возраст', 'Одежда', 'Внешность', 'Роль', 'Тело', 'Физиология', 'Здоровье', 'Болезни и травмы', 'Беременность',
  'Место', 'Мысли', 'Ключ', 'Ожидание vs Реальность', 'Скрытый подтекст', 'Инвентарь', 'Цели',
  'Расписание', 'Отношения', 'Доверие', 'Страхи', 'Реплики', 'Общие воспоминания', 'Флаг-монитор', 'Статус', 'Социальное разоблачение',
  'Глубина конфликта', 'Ревность', 'Конфликт', 'Сновидение',
  'Последний секс', 'Количество партнеров', 'Регулярность секса',
  'Фаза близости', 'NSFW', 'Карта тела', 'Кинк', 'Фетиш', 'Никогда не сделает', 'Не возбуждает',
  'Детализация NSFW', 'Забота после', 'Отзыв о сексе'];
// Доверие: то же устройство, что у карты тела, но шкала 0-100 и свой цвет.
// Доверие и отношение — разные вещи: любить и не доверять можно одновременно,
// поэтому шкала отдельная, а не строка внутри «Отношений».
function buildTrustMap(value) {
  return разбитьСписок(value).map(кусок => {
    const m = кусок.match(/^\s*([^:]+):\s*(.+)$/);
    if (!m) return кусок.trim() ? `<span class="hud-zone"><b>${escapeHtml(кусок.trim())}</b></span>` : '';
    const кто = m[1].trim();
    const сырое = m[2].trim();
    const число = parseFloat(сырое.replace(',', '.'));
    if (!Number.isFinite(число)) return `<span class="hud-zone"><b>${escapeHtml(кто)}</b><em>${escapeHtml(сырое)}</em></span>`;
    const доля = Math.max(0, Math.min(100, число));
    // Низкое доверие красим тревожно, высокое — спокойно: цвет несёт смысл,
    // иначе шкала читается только по длине полоски.
    const уровень = доля >= 66 ? 'is-high' : (доля >= 33 ? 'is-mid' : 'is-low');
    return `<span class="hud-zone ${уровень}" title="${escapeHtml(кто)}: ${escapeHtml(сырое)}">`
      + `<b class="hud-zone-name">${escapeHtml(кто)}</b>`
      + `<i class="hud-zone-bar"><i style="width:${доля}%"></i></i>`
      + `<em class="hud-zone-val">${Math.round(доля)}</em></span>`;
  }).filter(Boolean).join('');
}

// Страхи: значок подбираем по смыслу, чтобы список читался с одного взгляда.
// Ничего не подошло — общий значок, выдумывать соответствие не нужно.
const ЗНАЧКИ_СТРАХА = [
  [/смерт|умер|гибел|убь|death|die/i, '💀'],
  [/потер|уйдёт|уйдет|брос|один|одинок|lose|abandon/i, '💔'],
  [/узна|раскро|разоблач|правд|expose|truth/i, '🕵'],
  [/отец|мать|семь|родн|father|mother|family/i, '🏚'],
  [/темн|ночь|dark/i, '🌑'],
  [/боль|пытк|удар|pain|hurt/i, '🩸'],
  [/высот|паден|height|fall/i, '🕳'],
  [/вод|утон|water|drown/i, '🌊'],
  [/огон|пожар|fire|burn/i, '🔥'],
  [/тюрьм|клетк|запер|cage|prison/i, '🔒'],
];
// Сила страха словами. Порядок важен: «очень сильно» должно попасть в
// верхнюю ступень раньше, чем в среднюю по слову «сильно».
const СИЛА_СТРАХА = [
  [/пани[кч]|ужас|жутк|смертельн|невыносим|парализ|до\s*дрож/i, 'is-panic', 3],
  [/постоянн|очень\s+сильн|глубок|сильн|остро|не\s*отпускает/i, 'is-high', 3],
  [/средн|заметн|иногда|порой|时|периодич|временам/i, 'is-mid', 2],
  [/изредк|слаб|редк|немног|чуть|фонов/i, 'is-low', 1],
];

function buildFears(value) {
  return разбитьСписок(value).map(кусок => {
    const s = кусок.trim();
    if (!s) return '';
    const m = s.match(/^([^:]+):\s*(.+)$/);
    const что = m ? m[1].trim() : s;
    // Силу модель пишет кодом (low, mid, high, panic): на экран — словом, и
    // ступень дальше ищется по этому слову.
    const сколько = m ? силаСтраха(m[2].trim()) : '';
    const пара = ЗНАЧКИ_СТРАХА.find(([rx]) => rx.test(что));
    const значок = пара ? пара[1] : '😨';
    // Ступень ищем по слову силы. Не узнали слово — считаем средним: это
    // честнее, чем показать паникой или почти ничем.
    const ступень = сколько ? (СИЛА_СТРАХА.find(([rx]) => rx.test(сколько)) || [null, 'is-mid', 2]) : null;
    const класс = ступень ? ' ' + ступень[1] : '';
    const точек = ступень ? ступень[2] : 0;
    const точки = точек
      ? `<i class="hud-fear-dots" aria-hidden="true">`
        + [1,2,3].map(i => `<i${i <= точек ? ' class="on"' : ''}></i>`).join('')
        + `</i>`
      : '';
    const хвост = сколько ? `<em>${escapeHtml(сколько)}</em>` : '';
    return `<span class="hud-fear${класс}"${сколько ? ` title="${escapeHtml(что)}: ${escapeHtml(сколько)}"` : ''}>`
      + `<span class="hud-fear-ico" aria-hidden="true">${значок}</span>`
      + `<b>${escapeHtml(что)}</b>${хвост}${точки}</span>`;
  }).filter(Boolean).join('');
}

// Характерные реплики: цитаты, а не пересказ. Кавычки модель ставит сама,
// лишние снимаем — кавычку рисует стиль.
function buildLines(value) {
  return String(value || '').split(/[;\n]/).map(кусок => {
    const s = кусок.trim().replace(/^[«"'`]+|[»"'`]+$/g, '').trim();
    return s ? `<span class="hud-line-quote">${escapeHtml(s)}</span>` : '';
  }).filter(Boolean).join('');
}

// Фаза близости: пять шагов, текущий подсвечен, пройденные приглушены.
const ФАЗЫ = [
  ['foreplay', 'Прелюдия', /foreplay|прелюд|ласк/i],
  ['act', 'Близость', /^act$|акт|близост|секс|intercourse/i],
  ['climax', 'Пик', /climax|оргазм|пик|разрядк/i],
  ['aftercare', 'Забота', /aftercare|забот|уход/i],
  ['afterglow', 'После', /afterglow|послевкус|истом|после/i],
];
function buildScenePhase(value) {
  const s = String(value || '');
  const текущая = ФАЗЫ.findIndex(([, , rx]) => rx.test(s));
  if (текущая < 0) return `<span class="hud-nsfw-pill">${escapeHtml(s)}</span>`;
  return ФАЗЫ.map(([id, подпись], i) => {
    const состояние = i < текущая ? ' is-past' : (i === текущая ? ' is-now' : '');
    return `<span class="hud-phase-step${состояние}" data-phase="${id}">${escapeHtml(подпись)}</span>`;
  }).join('<i class="hud-phase-sep"></i>');
}

// Карта чувствительности: «Зона: 0-10». Значение вне шкалы не выдумываем —
// показываем как есть, без полоски.
function buildBodyMap(value) {
  return разбитьСписок(value).map(кусок => {
    const m = кусок.match(/^\s*([^:]+):\s*(.+)$/);
    if (!m) return кусок.trim() ? `<span class="hud-zone"><b>${escapeHtml(кусок.trim())}</b></span>` : '';
    const зона = m[1].trim();
    const сырое = m[2].trim();
    const число = parseFloat(сырое.replace(',', '.'));
    if (!Number.isFinite(число)) {
      return `<span class="hud-zone"><b>${escapeHtml(зона)}</b><em>${escapeHtml(сырое)}</em></span>`;
    }
    const доля = Math.max(0, Math.min(10, число)) * 10;
    // Ступень та же, что у доверия: цвет читается быстрее длины полоски.
    const уровень = доля >= 66 ? 'is-high' : (доля >= 33 ? 'is-mid' : 'is-low');
    return `<span class="hud-zone ${уровень}" title="${escapeHtml(зона)}: ${escapeHtml(сырое)}">`
      + `<b class="hud-zone-name">${escapeHtml(зона)}</b>`
      + `<i class="hud-zone-bar"><i style="width:${доля}%"></i></i>`
      + `<em class="hud-zone-val">${Math.round(число)}</em></span>`;
  }).filter(Boolean).join('');
}

/* Значок поля. Одна таблица на обе вкладки — и персонажа, и «Ты»: раньше
   лесенка из «иначе если» жила внутри сборщика карточки персонажа, и
   вкладка «Ты» осталась без значков вовсе. */
const ЗНАЧКИ_ПОЛЕЙ = {
  'возраст': '⏳', 'одежда': '👕', 'роль': '🎭', 'место': '📍',
  'цели': '🎯', 'инвентарь': '🎒', 'статус': '📌', 'тело': '🧍',
  'внешность': '🪞', 'здоровье': '🩺', 'болезни и травмы': '🩹', 'беременность': '🤰',
  'мысли': '💭', 'ожидание vs реальность': '🔮',
  'общие воспоминания': '🎞️', 'флаг-монитор': '🚩',
  'социальное разоблачение': '👁️', 'физиология': '🩸',
  'скрытый подтекст': '👁️‍🗨️', 'детали': '👁️‍🗨️',
  'отношения': '🤝', 'ревность': '💔', 'конфликт': '⚔️',
  'последний секс': '🛏️', 'количество партнеров': '👥',
  'регулярность секса': '📈', 'отзыв о сексе': '📝',
  'nsfw': '🔞', 'кинк': '🔗', 'фетиш': '🎀',
  'никогда не сделает': '⛔', 'не возбуждает': '🧊',
  'фаза близости': '🌡️', 'карта тела': '🫦', 'забота после': '🫂',
  'доверие': '🤍', 'страхи': '😨', 'реплики': '💬',
  'расписание': '🗓️', 'глубина конфликта': '⚔️', 'ключ': '🔑',
};

// Надпись поля на экране. Канонические имена «NSFW» и «Детализация NSFW»
// остаются внутри — по ним карточка решает, как строить строку, — а
// показываем их по смыслу из промта: одно пишется во время близости,
// другое после.
const НАДПИСИ_ПОЛЕЙ = {
  'nsfw': 'В близости', 'nsfw (юзер)': 'В близости',
  'детализация nsfw': 'После близости',
};
function надписьПоля(ключ) {
  return НАДПИСИ_ПОЛЕЙ[String(ключ || '').trim().toLowerCase()] || ключ;
}

// Возвращает значок с пробелом — ровно в том виде, в каком его клеили
// к подписи раньше. «Детализация NSFW» приходит с приставкой, поэтому
// её ловим отдельно, по вхождению.
function значокПоля(нижнийКлюч) {
  // Значок в своём элементе: в закрытой части карточки он сидит в
  // медальоне. Везде ещё у элемента нет оформления, и вид прежний.
  // Внутренний span нужен центровке: его сдвигают трансформацией, а сам
  // кружок и строка вокруг остаются на месте.
  const обернуть = (з) => '<i class="hud-key-ico" aria-hidden="true"><span>' + з + '</span></i> ';
  const точный = ЗНАЧКИ_ПОЛЕЙ[нижнийКлюч];
  if (точный) return обернуть(точный);
  if (нижнийКлюч.includes('детализация nsfw')) return обернуть('🔥');
  return '';
}

// Лицо собеседника в списке отношений: та же аватарка, что у шапки карточки
// персонажа. Если имя совпадает с именем игрока — аватарка игрока.
const нормИмя = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
function лицоСобеседника(имя) {
  const кто = нормИмя(имя);
  if (!кто) return null;
  const игрок = нормИмя(getSafeUserName());
  if (игрок && игрок !== 'user' && (кто === игрок || кто.split(' ')[0] === игрок.split(' ')[0])) {
    return getUserAvatarUrl() || null;
  }
  const найдено = getAvatarUrl(имя, false);
  return найдено && найдено.url ? найдено.url : null;
}

const orderFields = (obj) => {
  const rest = Object.keys(obj).filter(k => !FIELD_ORDER.includes(k));
  return [...FIELD_ORDER.filter(k => k in obj), ...rest].map(k => [k, obj[k]]);
};
const DRAMA_KEYS = ['ревность', 'конфликт', 'глубина конфликта'];
const TRUNCATE_KEYS = ['мысли', 'физиология'];

function formatKeyValue(text) {
  if (typeof Intl === 'undefined' || !Intl.Segmenter) return escapeHtml(text);
  const parts = Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text)).map(seg => ({ type: seg.segment.match(/\p{Emoji}/u) ? 'emoji' : 'text', value: seg.segment }));
  let html = '', currentText = '';
  for (let part of parts) {
    if (part.type === 'emoji') {
      if (currentText) { html += `<span class="hud-key-text">${applyTooltips(currentText)}</span>`; currentText = ''; }
      html += `<span class="hud-emoji">${escapeHtml(part.value)}</span>`;
    } else currentText += part.value;
  }
  if (currentText) html += `<span class="hud-key-text">${applyTooltips(currentText)}</span>`;
  return html;
}

// «код: значение; …» → объект по русским названиям меток в нижнем регистре.
// Кусок без метки считаем названием: «перелом руки» без nm — тоже болезнь.
function поМеткам(текст) {
  const out = {};
  String(текст || '').split(/[;\n]/).forEach(часть => {
    const m = часть.match(/^\s*([^:：]{1,40})[:：]\s*(.*)$/);
    if (!m) { if (часть.trim() && !out['что это']) out['что это'] = часть.trim(); return; }
    out[перевестиМетку(m[1]).toLowerCase()] = m[2].trim();
  });
  return out;
}

const строкаПодписи = (подпись, текст) => текст
  ? `<div class="hud-ill-row"><span>${escapeHtml(подпись)}</span><p>${applyTooltips(текст)}</p></div>`
  : '';

// Болезни и травмы: одна группа на состояние, группы через «|». Стадия
// окрашивает кромку, выздоровление — шкалой, симптомы и лечение строками.
function buildIllness(value) {
  return String(value || '').split(/\s*\|\s*|\n{2,}/).map(группа => {
    if (!группа.trim()) return '';
    const п = поМеткам(группа);
    const стадия = стадияБолезни(п['стадия']);
    const число = parseFloat(String(п['выздоровление'] || '').replace(',', '.'));
    const доля = Number.isFinite(число) ? Math.max(0, Math.min(100, число)) : null;
    return `<div class="hud-ill${стадия.ключ ? ' is-' + стадия.ключ : ''}">`
      + `<div class="hud-ill-head"><b>${escapeHtml(п['что это'] || 'Состояние')}</b>${стадия.текст ? `<em class="hud-ill-stage">${escapeHtml(стадия.текст)}</em>` : ''}</div>`
      + (доля !== null ? `<div class="hud-ill-meter" title="Выздоровление ${Math.round(доля)}%"><i style="width:${доля}%"></i><small>${Math.round(доля)}%</small></div>` : '')
      + строкаПодписи('Симптомы', п['симптомы'])
      + строкаПодписи('Лечение', п['лечение'])
      + `</div>`;
  }).filter(Boolean).join('');
}

// Беременность: срок шкалой на сорок недель с засечками триместров.
function buildPregnancy(value) {
  const п = поМеткам(value);
  const неделя = parseInt(String(п['неделя'] || '').replace(/[^\d]/g, ''), 10);
  const н = Number.isFinite(неделя) && неделя > 0 ? Math.min(неделя, 42) : null;
  const триместр = н === null ? '' : н < 14 ? 'I триместр' : н < 28 ? 'II триместр' : 'III триместр';
  return `<div class="hud-prg">`
    + `<div class="hud-prg-head"><span class="hud-prg-ico" aria-hidden="true">🤰</span><b>${н === null ? 'Срок не назван' : н + '-я неделя'}</b>`
    + `${триместр ? `<em>${триместр}</em>` : ''}${п['роды'] ? `<small>роды: ${escapeHtml(п['роды'])}</small>` : ''}</div>`
    + (н !== null ? `<div class="hud-prg-meter" title="${н} из 40 недель"><i style="width:${Math.min(100, н / 40 * 100).toFixed(1)}%"></i><s style="left:32.5%"></s><s style="left:67.5%"></s></div>` : '')
    + строкаПодписи('Отец', п['отец'])
    + строкаПодписи('Симптомы', п['симптомы'])
    + строкаПодписи('Кто знает', п['кто знает'])
    + строкаПодписи('Как проходит', п['как проходит'])
    + `</div>`;
}

// Что о вас думают: отношение каждого персонажа к игроку из его «Отношений»
// и число из «Доверия». Модели ничего дописывать не нужно — сводка
// собирается из того, что уже есть в карточках.
export function buildPerceptionHTML(characters) {
  const игрок = getSafeUserName();
  if (!игрок) return '';
  const карточки = (Array.isArray(characters) ? characters : []).map(c => {
    if (!c || typeof c !== 'object' || !c['Имя']) return null;
    const отношение = parseRelationList(flattenFieldValue(c['Отношения'])).find(r => namesLikelySame(r.target, игрок));
    const запись = parseRelationList(flattenFieldValue(c['Доверие'])).find(r => namesLikelySame(r.target, игрок));
    const число = запись ? parseFloat(String(запись.rel).replace(',', '.')) : NaN;
    const доверие = Number.isFinite(число) ? Math.max(0, Math.min(100, число)) : null;
    if (!отношение && доверие === null) return null;
    return { имя: String(c['Имя']), текст: отношение ? отношение.rel : '', доверие };
  }).filter(Boolean);
  if (!карточки.length) return '';
  const список = карточки.map(к => {
    const адрес = лицоСобеседника(к.имя);
    const буквы = к.имя.trim().split(/\s+/).map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase();
    const уровень = к.доверие === null ? '' : к.доверие >= 66 ? ' is-high' : к.доверие >= 33 ? ' is-mid' : ' is-low';
    const картинка = адрес
      ? `<img src="${escapeHtml(String(адрес)).replace(/"/g, '&quot;')}" alt="" loading="lazy" onerror="this.parentNode.classList.remove('has-img');this.remove()">`
      : '';
    return `<div class="hud-perc${уровень}">`
      + `<i class="hud-perc-face${адрес ? ' has-img' : ''}" aria-hidden="true">${escapeHtml(буквы)}${картинка}</i>`
      + `<div class="hud-perc-body"><b>${escapeHtml(к.имя)}</b>${к.текст ? `<p>${applyTooltips(к.текст)}</p>` : ''}`
      + (к.доверие !== null ? `<div class="hud-perc-trust" title="Доверие ${Math.round(к.доверие)} из 100"><span>доверие</span><i><i style="width:${к.доверие}%"></i></i><em>${Math.round(к.доверие)}</em></div>` : '')
      + `</div></div>`;
  }).join('');
  return `<div class="hud-row full-width hud-perception"><span class="hud-key"><i class="hud-key-ico" aria-hidden="true"><span>👁</span></i> Что о тебе думают:</span><div class="hud-perc-list">${список}</div></div>`;
}

export function buildUserHTML(userData, uid, isChecked, characters) {
  if (!userData || Object.keys(userData).length === 0) return '';
  const personaName = getSafeUserName();
  const avatarUrl = getUserAvatarUrl();
  const avaTag = ` data-ava-name="${escapeHtml(personaName)}" data-ava-role="user"`;
  const avatarHtml = avatarUrl ? `<img src="${avatarUrl}" class="hud-avatar hud-avatar-user" alt="avatar"${avaTag} onerror="this.outerHTML='<div class=&quot;hud-avatar-placeholder hud-avatar-user&quot;></div>'">` : `<div class="hud-avatar-placeholder hud-avatar-user"${avaTag}></div>`;

  const order = ['A', 'C', 'Ap', 'H', 'Ill', 'Prg', 'Rel', 'L', 'UW'];
  let rows = '';
  order.forEach(shortKey => {
    const label = mapKey(shortKey); let value = null;
    for (const [k, v] of Object.entries(userData)) { if (k === shortKey || k.toLowerCase() === label.toLowerCase()) { value = v; break; } }
    value = снятьЗаглушки(flattenFieldValue(value));
    if (!value || value.toLowerCase() === 'empty' || value.toLowerCase() === 'none') return;
    
    let rowClass = 'hud-row hud-user-row';
    if (label.toLowerCase().includes('nsfw')) rowClass += ' full-width nsfw';

    // Значок берём из той же таблицы, что и карточка персонажа: поля
    // здесь те же самые, и разнобой бросался бы в глаза при переключении.
    const значок = значокПоля(label.toLowerCase());
    if (label.toLowerCase() === 'отношения') {
      rows += `<div class="${rowClass}"><span class="hud-key">${значок}${escapeHtml(label)}:</span> <div class="hud-vertical-container">${buildPillList(value, 'hud-detail-pill', false, 'отношения', лицоСобеседника)}</div></div>`;
    } else if (label.toLowerCase().includes('nsfw')) {
      rows += `<div class="${rowClass}"><span class="hud-key"><i class="hud-key-ico" aria-hidden="true"><span>🔞</span></i> ${escapeHtml(надписьПоля(label))}:</span> <div class="hud-vertical-container">${buildPillList(value, 'hud-nsfw-pill')}</div></div>`;
    } else if (label.toLowerCase() === 'болезни и травмы') {
      rows += `<div class="${rowClass} full-width"><span class="hud-key">${значок}${escapeHtml(label)}:</span> <div class="hud-ill-list">${buildIllness(value)}</div></div>`;
    } else if (label.toLowerCase() === 'беременность') {
      rows += `<div class="${rowClass} full-width"><span class="hud-key">${значок}${escapeHtml(label)}:</span> ${buildPregnancy(value)}</div>`;
    } else {
      rows += `<div class="${rowClass}"><span class="hud-key">${значок}${escapeHtml(label)}:</span> <span class="hud-value">${applyTooltips(String(value))}</span></div>`;
    }
  });
  const восприятие = settings.enablePerception !== false ? buildPerceptionHTML(characters) : '';
  if (!rows && !восприятие) return '';
  return `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}"><div class="hud-header hud-user-header"><div class="hud-header-info">${avatarHtml}<div class="hud-header-text"><span class="hud-title">${escapeHtml(personaName)}</span></div></div></div><div class="hud-body hud-user-body">${восприятие}${rows}</div></div>`;
}

export function buildCharacterHTML(charData, uid, isChecked, isPrimary) {
  if (!charData || Object.keys(charData).length === 0) return '';
  const charName = charData['Имя'] || 'Unknown NPC';
  const avatar = getAvatarUrl(charName, isPrimary);
  const avaTag = ` data-ava-name="${escapeHtml(charName)}"`;
  const avatarHtml = avatar ? `<img src="${avatar.url}" data-hud-fallback="${avatar.thumbUrl}" class="hud-avatar" alt="avatar"${avaTag} onerror="if(!this.dataset.hudTried && this.dataset.hudFallback){this.dataset.hudTried='1'; this.src=this.dataset.hudFallback;} else {this.outerHTML='<div class=&quot;hud-avatar-placeholder&quot;>👤</div>';}">` : `<div class="hud-avatar-placeholder"${avaTag}>👤</div>`;

  let html = `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}"><div class="hud-header"><div class="hud-header-info">${avatarHtml}<div class="hud-header-text"><span class="hud-title">${escapeHtml(charName)}</span></div></div></div><div class="hud-body">`;

  for (const [key, rawValue] of orderFields(charData)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'имя') continue;
    // Объект или массив здесь — обычное дело: схема просит строку «Метка:
    // значение; ...», а модель нередко отдаёт ту же структуру объектом.
    // Разворачиваем сразу, чтобы ниже по коду везде была строка.
    const value = снятьЗаглушки(flattenFieldValue(rawValue));
    if (!value || value.toLowerCase() === 'empty' || value.toLowerCase() === 'none') continue;
    let rowClass = FULL_WIDTH_KEYS.some(k => lowerKey.includes(k)) ? 'hud-row full-width' : 'hud-row';
    if (DRAMA_KEYS.some(k => lowerKey.includes(k))) rowClass += ' drama-alert';
    if (lowerKey.includes('nsfw') || lowerKey.includes('секс') || lowerKey.includes('партнеров')
        || lowerKey === 'кинк' || lowerKey === 'фетиш' || lowerKey === 'никогда не сделает' || lowerKey === 'не возбуждает'
        // Фаза близости, карта тела и забота после по смыслу лежат там же,
        // а оформления закрытой части не получали — блок распадался на две
        // половины с разным видом.
        || lowerKey === 'фаза близости' || lowerKey === 'карта тела' || lowerKey === 'забота после') rowClass += ' nsfw';

    const icon = значокПоля(lowerKey);

    let valueClass = TRUNCATE_KEYS.some(k => lowerKey.includes(k)) ? 'hud-value hud-truncate' : 'hud-value';

    if (lowerKey === 'доверие') {
      html += `<div class="${rowClass} full-width"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div class="hud-bodymap hud-trustmap">${buildTrustMap(value)}</div></div>`;
    } else if (lowerKey === 'страхи') {
      html += `<div class="${rowClass} full-width"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div class="hud-fears">${buildFears(value)}</div></div>`;
    } else if (lowerKey === 'реплики') {
      html += `<div class="${rowClass} full-width"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div class="hud-lines">${buildLines(value)}</div></div>`;
    } else if (lowerKey === 'фаза близости') {
      // Пять шагов сцены полосой: видно, где мы сейчас и что уже позади.
      html += `<div class="${rowClass}"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div>${buildScenePhase(value)}</div></div>`;
    } else if (lowerKey === 'карта тела') {
      // Зона и её чувствительность от нуля до десяти — шкалой, а не числом:
      // «Шея: 9» рядом с «Поясница: 4» читается взглядом, а не чтением.
      html += `<div class="${rowClass} full-width"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div class="hud-bodymap">${buildBodyMap(value)}</div></div>`;
    } else if (lowerKey === 'болезни и травмы') {
      html += `<div class="${rowClass} full-width"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div class="hud-ill-list">${buildIllness(value)}</div></div>`;
    } else if (lowerKey === 'беременность') {
      html += `<div class="${rowClass} full-width"><span class="hud-key">${icon}${escapeHtml(key)}:</span> ${buildPregnancy(value)}</div>`;
    } else if (lowerKey === 'ключ') {
      const items = String(value).split(';').filter(i => i.trim().length > 0).map(i => `<div class="hud-key-item">${formatKeyValue(i.trim())}</div>`).join('');
      html += `<div class="hud-key-block full-width"><span class="hud-key-label">${escapeHtml(key)}:</span> <div class="hud-vertical-container hud-key-list">${items}</div></div>`;
    } else if (lowerKey === 'инвентарь') {
      html += `<div class="${rowClass}"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div class="hud-inventory-grid">${buildPillList(value, 'hud-inventory-pill')}</div></div>`;
    } else if (lowerKey === 'nsfw' || lowerKey === 'детализация nsfw' || lowerKey === 'последний секс') {
      html += `<div class="${rowClass}"><span class="hud-key">${icon}${escapeHtml(надписьПоля(key))}:</span> <div class="hud-vertical-container">${buildPillList(value, 'hud-nsfw-pill', true)}</div></div>`;
    } else if (lowerKey === 'кинк' || lowerKey === 'фетиш' || lowerKey === 'никогда не сделает' || lowerKey === 'не возбуждает') {
      // Каждый пункт — своя пилюля даже без явного разделителя: это списки,
      // а не связный текст, склеивать их обратно нельзя.
      const pillClass = lowerKey === 'кинк' ? 'hud-kink-pill'
        : lowerKey === 'фетиш' ? 'hud-fetish-pill'
        : lowerKey === 'никогда не сделает' ? 'hud-nogo-pill' : 'hud-noturn-pill';
      html += `<div class="${rowClass}"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div class="hud-vertical-container">${buildPillList(value, pillClass, true)}</div></div>`;
    } else if (lowerKey === 'расписание') {
      const items = String(value).split(String(value).includes(';') ? /;/ : /(?:\.\s+(?=[А-ЯA-ZА-ЯЁ])|\n)/)
        .filter(i => i.trim().length > 0).map(i => {
          let text = i.trim().replace(/\.$/, ''); let timeMatch = text.match(/^([\d]{1,2}:\d{2})\s*[-—–:]?\s*(.*)$/);
          return timeMatch ? `<div class="hud-schedule-item"><div class="hud-schedule-time">${escapeHtml(timeMatch[1])}</div><div class="hud-schedule-event">${applyTooltips(timeMatch[2])}</div></div>` : `<div class="hud-schedule-item"><div class="hud-schedule-event">${applyTooltips(text)}</div></div>`;
        }).join('');
      html += `<div class="${rowClass} full-width"><div class="hud-schedule-container">${items}</div></div>`;
    } else if (lowerKey === 'ожидание vs реальность') {
      html += `<div class="${rowClass} full-width"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div class="hud-exp-reality">${buildPillList(value, '')}</div></div>`;
    } else if (lowerKey === 'глубина конфликта') {
      html += `<div class="${rowClass}"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div class="hud-vertical-container">${buildPillList(value, 'hud-conflict-pill')}</div></div>`;
    } else if (lowerKey === 'отзыв о сексе') {
      html += `<div class="${rowClass} full-width"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <span class="${valueClass} hud-sex-rev">${applyTooltips(String(value)).replace(/([★☆]+)/g, '<span class="hud-stars-rating">$1</span>')}</span></div>`;
    } else if (lowerKey === 'общие воспоминания') {
      // Общее воспоминание — готовая запись для Lorebook: у неё есть и факт,
      // и участник, чьё имя станет ключом активации.
      const items = value.split(';').map(x => x.trim()).filter(Boolean);
      const memHtml = items.map(item => {
        const isNew = isNewLoreItem(item);
        return `<div class="hud-detail-pill hud-lore-item${isNew ? ' is-new' : ''}">` +
          `<span class="hud-lore-text">${escapeHtml(item)}</span>` +
          loreButtonHTML(item, [charName], isNew) + `</div>`;
      }).join('');
      html += `<div class="${rowClass}"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div class="hud-vertical-container">${memHtml}</div></div>`;
    } else if (lowerKey === 'отношения' || lowerKey === 'цели' || lowerKey === 'ревность' || lowerKey === 'флаг-монитор') {
      html += `<div class="${rowClass}"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div class="hud-vertical-container">${buildPillList(value, 'hud-detail-pill', (lowerKey === 'общие воспоминания' || lowerKey === 'флаг-монитор'), lowerKey, лицоСобеседника)}</div></div>`;
    } else {
      html += `<div class="${rowClass}"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <span class="${valueClass}">${applyTooltips(String(value))}</span></div>`;
    }
  }
  return html + `</div></div>`;
}
