// hud-manager/utils.js
//
// Мелкие утилиты, общие для всех доменов HUD (дневник, мир, сны, телефон,
// граф отношений, память). Вынесено из index.js без изменения поведения.

import { МЕТКИ } from './codes.js?v=23.13.2';
import { НАЗВАНИЯ_ПОЛЕЙ } from './key-names.js?v=23.13.2';

/** Экранирование через DOM: браузер сам решает, что считать опасным. */
// Не выпускать касания наружу. SillyTavern ловит свайпы на уровне document
// (библиотека swiped-events) и переключает по ним вариант ответа. Внутри
// наших окон и карточек горизонтальное движение пальцем — это прокрутка
// вкладок или перетаскивание ползунка, а не «покажи другой ответ».
export function guardTouchSwipe(el) {
  if (!el || el.dataset.swipeGuard === 'true') return el;
  ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(type => {
    el.addEventListener(type, e => e.stopPropagation(), { passive: true });
  });
  el.dataset.swipeGuard = 'true';
  return el;
}

// Текст без разметки. Разбирает DOMParser: в его документе скрипты не
// запускаются и картинки не грузятся, а вот у innerHTML отстёгнутого div
// <img onerror> срабатывает. Регулярка replace(/<[^>]+>/g, '') ломалась на
// «>» внутри атрибута и пропускала недописанный тег.
export function sanitizeText(value) {
  const s = value === null || value === undefined ? '' : String(value);
  if (!/[<&]/.test(s)) return s;
  try {
    const doc = new DOMParser().parseFromString('<!doctype html><body>' + s.replace(/<br\s*\/?>/gi, '\n'), 'text/html');
    return (doc.body && doc.body.textContent) || '';
  } catch (_) {
    return s.replace(/<[^>]*>?/g, '');
  }
}

// Модель иногда переписывает заглушки формата буквально: «fear: Софи узнает —
// strength: high» вместо «Софи узнает: high». Снимаем слова-заглушки и
// оставляем то, что должно было стоять на их месте.
const ЗАГЛУШКА_МЕТКИ = /^\s*(?:fear|name|item|thing|limit|activity|zone|label|code|страх|предмет|метка)\s*[:：]\s*(?=\S)/i;
// Граница слова — просмотром назад по буквам, а не \b: без флага u кириллица
// для \b не буква, и «сила:» не находилась никогда.
const ЗАГЛУШКА_ЗНАЧЕНИЯ = /\s*(?:[—–-]\s*|,\s*|\(\s*)?(?<![\p{L}\p{N}_])(?:strength|condition|attitude|role|reason|number|value|effect|сила)\s*[:：]\s*/giu;
export function снятьЗаглушки(value) {
  const s = value === null || value === undefined ? '' : String(value);
  if (!/(?<![\p{L}\p{N}_])(?:fear|name|item|thing|limit|activity|zone|label|code|strength|condition|attitude|role|reason|number|value|effect|страх|предмет|метка|сила)\s*[:：]/iu.test(s)) return s;
  return s.split(/(\s*[;\n]\s*)/).map(кусок => {
    if (/^\s*[;\n]\s*$/.test(кусок)) return кусок;
    const безМетки = кусок.replace(ЗАГЛУШКА_МЕТКИ, '');
    return безМетки.replace(ЗАГЛУШКА_ЗНАЧЕНИЯ, ': ').replace(/:\s*:\s*/g, ': ').replace(/^\s*:\s*/, '').replace(/\)\s*$/, (м) => (безМетки.includes('(') && !безМетки.replace(ЗАГЛУШКА_ЗНАЧЕНИЯ, ': ').includes('(') ? '' : м));
  }).join('');
}

// Кавычки тоже: innerHTML текстового узла их не трогает, а результат часто
// уходит в атрибут (title="…", data-labels="…") — первая же кавычка в тексте
// обрывала атрибут.
const СУЩНОСТИ = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(str) { if (!str) return ''; return String(str).replace(/[&<>"']/g, з => СУЩНОСТИ[з]); }

// Схема ждёт строку «Метка: значение; ...», но модель нередко отдаёт объект
// или массив объектов. Прямой String() на таком значении даёт «[object
// Object]» — именно так NSFW и превращался в мусор при полностью корректном
// JSON. Разворачиваем в ту же строку с метками: дальше её разберут как обычно.
export function flattenFieldValue(value, depth = 0) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return String(value);
  // Верхний уровень задаёт пилюли: «Метка: значение», через «;». Всё, что
  // глубже, — уже начинка одной пилюли, там свои разделители, иначе вложенный
  // объект расщепился бы на отдельные пилюли и потерял бы имя родителя.
  const pairSep = depth === 0 ? '; ' : ', ';
  const kv = depth === 0 ? ': ' : ' — ';
  if (Array.isArray(value)) {
    return value.map(v => flattenFieldValue(v, depth)).map(s => s.trim()).filter(Boolean).join(pairSep);
  }
  return Object.entries(value)
    .map(([k, v]) => {
      const inner = flattenFieldValue(v, depth + 1).trim();
      return inner ? k + kv + inner : '';
    })
    .filter(Boolean)
    .join(pairSep);
}

// A value is considered renderable only when it contains actual content.
// Keep the old tab-visibility contract: empty/none/empty-like payloads do not
// create a whole top-level tab.
const ПУСТЫШКИ = new Set(['empty', 'none', 'null', 'undefined', 'пусто', 'нет', 'нету', 'ничего', 'отсутствует', 'n/a', 'na', 'new this turn']);
// Кавычки, скобки, точки и тире по краям не содержание: «-», «[]», «empty.»,
// «<new this turn>» — те же пустышки, что и «empty».
const КРАЯ_ПУСТЫШКИ = /^[\s"'«»“”„`[\](){}<>.,;:!?…—–-]+|[\s"'«»“”„`[\](){}<>.,;:!?…—–-]+$/g;
export function hudHasMeaningfulValue(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some(hudHasMeaningfulValue);
  if (typeof value === 'object') return Object.values(value).some(hudHasMeaningfulValue);
  const text = String(value).trim().toLowerCase().replace(КРАЯ_ПУСТЫШКИ, '');
  return !!text && !ПУСТЫШКИ.has(text);
}

// УМНОЕ ПОЛУЧЕНИЕ ИМЕНИ ПОЛЬЗОВАТЕЛЯ ИЗ SILLYTAVERN
export function getSafeUserName() {
  try {
      if (typeof window !== 'undefined' && window.name1 && String(window.name1).trim()) return String(window.name1).trim();
      const ctx = typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function' ? SillyTavern.getContext() : (typeof getContext === 'function' ? getContext() : null);
      if (ctx && ctx.name1) return String(ctx.name1).trim();
  } catch(e) {}
  return 'User';
}

export function hudFilled(v) {
  return v !== null && v !== undefined && String(v).trim() !== '' && !/^(empty|none)$/i.test(String(v).trim());
}

export function hudHashSeed(str) {
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function commentInitials(name) {
  const parts = String(name || 'А').split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  return String(name || 'А').slice(0, 2).toUpperCase();
}

export function applyTooltips(text) {
  return escapeHtml(text);
}

// Метка пилюли: «Имя: значение», «Имя — значение», «Имя - значение».
//
// Набор символов юникодный, а не список алфавитов:
//   \p{L} — любая буква, включая é, ö, ñ и прочие диакритические;
//   \p{M} — комбинирующие знаки, если «закорюка» пришла отдельным
//           кодпоинтом (e + U+0301), а не готовой буквой é;
//   дефис и апостроф — для двойных фамилий («Анна-Мария», «O’Brien»).
// Прежний набор [A-Za-zА-Яа-яЁё0-9...] такие имена не пропускал, метка
// не распознавалась, и кусок приклеивался к предыдущей пилюле.
// Явные разделители списка: обычная «;», полноширинная «；» (U+FF1B),
// арабская «؛» (U+061B) и перевод строки.
const EXPLICIT_SPLIT_RE = /[;\uFF1B\u061B\n]+/;

const PILL_LABEL_RE = /^([\p{L}\p{M}\p{N}\s/(),.'’\u2019-]{2,80}?)(:|\uFF1A|—|–|\s-)\s*(.*)$/u;

// Ищем зачины «Метка: » и режем строку перед каждым из них. Возвращает
// null, если меток меньше двух — тогда работает прежняя эвристика по «. ».
const LABEL_START_RE = /(?:^|[,.;]\s+|\s+[\u2014\u2013]\s+)([\p{L}\p{M}][\p{L}\p{M}\p{N}\s/()'\u2019-]{1,40}?)\s*[:\uFF1A]\s/gu;
function splitByLabels(text) {
    const cuts = [];
    LABEL_START_RE.lastIndex = 0;
    let m;
    while ((m = LABEL_START_RE.exec(text)) !== null) {
        cuts.push(m.index + m[0].indexOf(m[1]));
        // Следующий поиск начинаем сразу после двоеточия, иначе значение
        // с собственным двоеточием внутри съело бы соседнюю метку.
        LABEL_START_RE.lastIndex = m.index + m[0].length;
    }
    if (cuts.length < 2) return null;
    const parts = [];
    if (cuts[0] > 0) {
        const head = text.slice(0, cuts[0]).trim();
        if (head) parts.push(head);
    }
    for (let i = 0; i < cuts.length; i++) {
        parts.push(text.slice(cuts[i], i + 1 < cuts.length ? cuts[i + 1] : undefined));
    }
    return parts.map(p => p.replace(/[\s,;.]+$/, '').trim()).filter(Boolean);
}

// Горизонт цели. Порядок важен: «в будущем» должно попасть в дальний
// горизонт раньше, чем в ближний по слову «буд».
const ГОРИЗОНТЫ = [
  [/^\s*(сейчас|now|сию|немедленн)/i, 'is-now'],
  [/^\s*(скоро|soon|ближ|сегодня|вечер)/i, 'is-soon'],
  [/^\s*(будущ|потом|later|долгосроч|дальш)/i, 'is-later'],
];

// Значение целиком числовое (с единицей или без) — «11», «58 см», «75%».
const ЧИСЛО_ЦЕЛИКОМ = /^[<>~≈]?\s*\d+(?:[.,]\d+)?\s*(?:%|см|кг|м|мм|лет|года?|дней|дня|раз(?:а)?)?$/i;

// Английские метки, которые модель писала в полях закрытой части: частью по
// старым примерам промта, частью по привычке. Список собран сканом реальных
// чатов. Переводим только знакомые — незнакомую метку показываем как есть.
const ПЕРЕВОД_МЕТОК = {
  'date': 'Дата', 'partner': 'Партнёр', 'acts': 'Что было', 'ending': 'Финал',
  'penis state': 'Состояние члена', 'fetishes active': 'Активные фетиши',
  'volume': 'Громкость', 'smell': 'Запах', 'traces': 'Следы',
  'arousal level': 'Возбуждение', 'arousal': 'Возбуждение', 'protection': 'Защита',
  'sensitivity': 'Чувствительность', 'readiness for round 2': 'Готовность ко второму разу',
  'readiness': 'Готовность', 'physical aftermath': 'Тело после', 'emotional aftermath': 'Чувства после',
  'position': 'Поза', 'duration': 'Длительность', 'place': 'Место', 'location': 'Место',
  'mood': 'Настроение', 'desire level': 'Желание', 'lubrication': 'Смазка', 'wetness': 'Смазка',
  'orgasm': 'Оргазм', 'stamina': 'Выносливость', 'consent': 'Согласие',
};
// Сначала короткие коды из промта (vol, round2, now…), потом английские
// слова, которые модель писала по старым примерам.
export function перевестиМетку(метка) {
  const чистая = String(метка || '').trim();
  const ключ = чистая.toLowerCase().replace(/\s+/g, ' ');
  return МЕТКИ[ключ] || ПЕРЕВОД_МЕТОК[ключ] || чистая;
}

// Значки к меткам, которые повторяются из карточки в карточку. Только
// знакомые: выдумывать соответствие для произвольной метки нельзя.
const ЗНАЧКИ_МЕТОК = {
  'date': '📅', 'дата': '📅', 'когда': '📅',
  'partner': '👤', 'партнер': '👤', 'партнёр': '👤', 'с кем': '👤',
  'acts': '🔥', 'акты': '🔥', 'что было': '🔥',
  'ending': '💧', 'финал': '💧', 'конец': '💧',
  'place': '📍', 'место': '📍', 'где': '📍',
  'position': '📐', 'поза': '📐',
  'duration': '⏱', 'длительность': '⏱', 'сколько': '⏱',
  'protection': '🛡', 'защита': '🛡',
  'mood': '🌡', 'настроение': '🌡',
  'причина': '🎯', 'reason': '🎯',
  'дней': '📆', 'days': '📆',
  'стадия': '🪜', 'stage': '🪜',
  'sensitivity': '🎚', 'чувствительность': '🎚',
  'readiness': '🎚', 'готовность': '🎚',
  // Русские метки, в которые переводятся английские из закрытой части.
  'состояние члена': '🍆', 'активные фетиши': '🎀', 'громкость': '🔊',
  'запах': '🌫', 'следы': '💋', 'возбуждение': '💓',
  'готовность ко второму разу': '🔁', 'тело после': '🫧', 'чувства после': '💭',
  'желание': '💗', 'смазка': '💦', 'оргазм': '✨', 'выносливость': '🔋', 'согласие': '🤝',
  // Русские метки, которые модель уже писала сама по старому промту: те же
  // смыслы другими словами. Без них плитка из старого хода стояла без значка
  // рядом с переведённой соседкой со значком.
  'уровень возбуждения': '💓', 'уровень желания': '💗', 'состояние пениса': '🍆',
  'предохранение': '🛡', 'готовность ко 2 раунду': '🔁', 'окончание': '💧',
  'лобок/волосы': '🌿', 'анатомия': '🌸', 'грудь/соски': '🍒',
  'прикосновения': '🤲', 'реакции тела': '⚡', 'лицо и взгляд': '👀', 'влага и жидкости': '💧',
  'физические последствия': '🫧', 'эмоциональные последствия': '💭',
};

// Доля процентом в начале значения: «90%», «60% — слухи уже поползли».
const ДОЛЯ = /^\s*(\d{1,3})\s*%/;

// Количество предметов: «Патроны ×30», «Ключи x2».
const КОЛИЧЕСТВО = /\s*[×xх]\s*(\d+)\s*$/i;

function инициалы(имя) {
  const части = String(имя || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  if (!части.length) return '·';
  if (части.length === 1) return части[0].slice(0, 1).toUpperCase();
  return (части[0][0] + части[1][0]).toUpperCase();
}

// лицоПоИмени — необязательная функция «имя → адрес аватарки или null». Нужна
// списку отношений: сами утилиты об аватарках ничего не знают.
// Пункты списка разделяет только «;» (и её полноширинный и арабский
// варианты) или перевод строки. Запятая — нет: ею модель уточняет внутри
// одного пункта («опекун, заменил отца»).
export function разбитьСписок(текст) {
  return String(текст ?? '').split(/[;\uFF1B\u061B\n]+/);
}

export function buildPillList(value, pillClass, forceSeparate = false, вид = '', лицоПоИмени = null) {
    const raw = flattenFieldValue(value);
    // Явный разделитель — воля автора: каждый кусок становится отдельной
    // пилюлей, даже если метку в нём распознать не удалось. Кроме обычной
    // «;» ловим её полноширинный и арабский варианты: модель иногда
    // отдаёт именно их, и текст склеивался в одну длинную пилюлю.
    // Разбиение по «. » — эвристика для сплошного текста, и только там
    // куски можно склеивать обратно в одно предложение.
    const explicit = EXPLICIT_SPLIT_RE.test(raw);
    // Явного разделителя может не быть: модель перечисляет пункты через
    // запятую («Sensitivity: 8, Readiness: high, ...»), и вся строка
    // склеивалась в одну длинную пилюлю — так вело себя поле
    // «Детализация NSFW». Если «;» нет, но в тексте два и больше зачинов
    // вида «Метка: », режем прямо перед метками. Куски при этом уже
    // разделены автором по смыслу, поэтому склеивать их обратно нельзя.
    const byLabel = explicit ? null : splitByLabels(raw);
    const separated = explicit || !!byLabel;
    const rawChunks = (explicit ? разбитьСписок(raw) : (byLabel || raw.split('. ')))
        .map(i => i.trim()).filter(i => i);

    const items = [];
    for (const chunk of rawChunks) {
        const match = chunk.match(PILL_LABEL_RE);
        // В «Отношениях» метка — это имя: переводить его как код нельзя,
        // человек по имени Date остался бы «Датой».
        if (match) { items.push({ label: вид === 'отношения' ? match[1].trim() : перевестиМетку(match[1]), sep: match[2], text: match[3] }); }
        else if (items.length > 0 && items[items.length - 1].label && /(?:kink|fetish|nogo|noturn)-pill/.test(pillClass)
            && chunk.split(/\s+/).length <= 4 && !/[.!?…]$/.test(chunk)) {
            // «Жёсткий секс: да, предпочитает доминирование; охотно» — «насколько
            // охотно» модель отделила «;» от своей метки. Без метки такой хвост
            // стоял отдельной непонятной плиткой; возвращаем его на место.
            items[items.length - 1].text += ', ' + chunk;
        }
        else if (items.length > 0 && !forceSeparate && !separated) {
            // Продолжение предыдущего предложения — дописываем в ту же пилюлю.
            items[items.length - 1].text += '. ' + chunk;
        }
        else { items.push({ label: '', sep: '', text: chunk }); }
    }
    return items.map(item => {
        let классы = pillClass;
        let передМеткой = '';
        // Переменные плитки: корешок и налёт фона читают их со самой
        // плитки, а не с вложенного кружка.
        let стиль = '';
        // Горизонт цели: кромка и метка окрашиваются по нему.
        if (вид === 'цели' && item.label) {
            const г = ГОРИЗОНТЫ.find(([rx]) => rx.test(item.label));
            if (г) классы += ' ' + г[1];
        }
        // Отношения: кружок с инициалами, цвет выводим из имени, чтобы
        // один и тот же человек всегда был одного цвета.
        if (вид === 'отношения' && item.label) {
            // Тон человека — сдвиг от главного тона темы (palette.js пишет
            // --hud-tone-base): каждый различим, но все в гамме темы.
            const сдвиг = hudHashSeed(item.label) % 81 - 40;
            классы += ' has-face';
            стиль += '--тон-сдвиг:' + сдвиг + ';';
            // Аватарка ложится поверх инициалов. Не загрузилась — картинка
            // убирает себя, и снова видны инициалы.
            let адрес = null;
            try { адрес = typeof лицоПоИмени === 'function' ? лицоПоИмени(item.label) : null; } catch (_) { адрес = null; }
            const картинка = адрес
              ? `<img src="${escapeHtml(String(адрес)).replace(/"/g, '&quot;')}" alt="" loading="lazy"`
                + ` onerror="this.parentNode.classList.remove('has-img');this.remove()">`
              : '';
            передМеткой = `<i class="hud-pill-face${адрес ? ' has-img' : ''}" aria-hidden="true">`
              + `${escapeHtml(инициалы(item.label))}${картинка}</i>`;
        }
        // Значок знакомой метки. Ставим перед подписью, саму подпись не
        // трогаем: кто читает, а не сканирует, ничего не теряет.
        const значокМетки = item.label
            ? ЗНАЧКИ_МЕТОК[item.label.trim().toLowerCase().replace(/ё/g, 'е')] || ''
            : '';
        const labelHtml = item.label
            ? `<span class="hud-pill-label">`
              + (значокМетки ? `<i class="hud-pill-ico" aria-hidden="true">${значокМетки}</i>` : '')
              + `${escapeHtml(item.label)}${escapeHtml(item.sep)}</span> `
            : '';
        // Количество отделяем от названия: «Патроны ×30» читается как
        // название и число, а не как одна длинная строка.
        const кол = item.text.match(КОЛИЧЕСТВО);
        const тело = кол ? item.text.slice(0, кол.index).trim() : item.text;
        // Число — плашкой: в столбце из нескольких пилюль они встают в ряд.
        const текст = ЧИСЛО_ЦЕЛИКОМ.test(тело)
            ? `<span class="hud-pill-num">${escapeHtml(тело)}</span>`
            : applyTooltips(тело);
        // Пробел перед плашкой нужен только если перед ней что-то есть: у
        // «Патроны: ×30» тела нет вовсе, и пробел давал двойной отступ.
        const хвостКол = кол ? (тело ? ' ' : '') + `<span class="hud-pill-count">×${escapeHtml(кол[1])}</span>` : '';
        // Доля процентом — полоской по низу плитки: две такие пилюли
        // сравниваются взглядом, а не чтением.
        const д = item.text.match(ДОЛЯ);
        let полоса = '';
        if (д) {
            классы += ' has-meter';
            полоса = `<i class="hud-pill-meter" style="--доля:${Math.min(100, Number(д[1]))}%" aria-hidden="true"></i>`;
        }
        const атрибутСтиля = стиль ? ` style="${стиль}"` : '';
        return `<div class="${классы}"${атрибутСтиля}>${передМеткой}${labelHtml}${текст}${хвостКол}${полоса}</div>`;
    }).join('');
}

// Канонизация ключей HUD: модель присылает и короткие коды ('T', 'Wth'),
// и русские/английские названия. Нужна и парсеру, и рендеру карточек.
const нормаКлюча = (s) => String(s).trim().toLowerCase().replace(/[ё]/g, 'е').replace(/[\s_-]+/g, ' ');
let таблицаКлючей = null;
export function mapKey(k) {
  const raw = String(k ?? '').trim();
  const n = нормаКлюча(raw);
  if (!таблицаКлючей) {
    // Строим один раз: прежде объект из полутора сотен пар создавался
    // заново на каждый вызов, а вызовов на карточку — сотни. Ключи словаря
    // нормализуются так же, как входное имя: иначе «flag-monitor» и
    // «nsfw_det» не находились никогда.
    таблицаКлючей = new Map();
    for (const [к, имя] of Object.entries(НАЗВАНИЯ_ПОЛЕЙ)) таблицаКлючей.set(нормаКлюча(к), имя);
  }
  return таблицаКлючей.get(n) || raw;
}

// Ноль-ширинный пробел после первой буквы: не даёт World Info поймать
// имя из HUD как ключевое слово и активировать лорбук.
export function defeatWI(text) {
    if (!text || typeof text !== 'string' || text.length < 2) return text;
    // \u0422\u0435\u043A\u0441\u0442 \u0443\u0436\u0435 \u044D\u043A\u0440\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D \u0438 \u043D\u0430\u0447\u0438\u043D\u0430\u0435\u0442\u0441\u044F \u0441 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u0438 (&quot;\u2026) \u2014 \u0441\u0442\u0430\u0432\u0438\u043C
    // \u043D\u0435\u0432\u0438\u0434\u0438\u043C\u044B\u0439 \u0437\u043D\u0430\u043A \u043F\u043E\u0441\u043B\u0435 \u043D\u0435\u0451, \u0430 \u043D\u0435 \u0432\u043D\u0443\u0442\u0440\u044C.
    const \u0433\u043E\u043B\u043E\u0432\u0430 = (text.match(/^&(?:#\d+|#x[\da-f]+|[a-z]+);/i) || [text.charAt(0)])[0];
    return \u0433\u043E\u043B\u043E\u0432\u0430 + '\u200B' + text.slice(\u0433\u043E\u043B\u043E\u0432\u0430.length);
}
