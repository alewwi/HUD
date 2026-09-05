// hud-manager/utils.js
//
// Мелкие утилиты, общие для всех доменов HUD (дневник, мир, сны, телефон,
// граф отношений, память). Вынесено из index.js без изменения поведения.

/** Экранирование через DOM: браузер сам решает, что считать опасным. */
export function escapeHtml(str) { if (!str) return ''; const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }

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
export function hudHasMeaningfulValue(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some(hudHasMeaningfulValue);
  if (typeof value === 'object') return Object.values(value).some(hudHasMeaningfulValue);
  const text = String(value).trim().toLowerCase();
  return !!text && !['empty', 'none', 'null', 'undefined', 'пусто', 'нет', 'отсутствует'].includes(text);
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

export function buildPillList(value, pillClass, forceSeparate = false) {
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
    const rawChunks = (explicit ? raw.split(EXPLICIT_SPLIT_RE) : (byLabel || raw.split('. ')))
        .map(i => i.trim()).filter(i => i);

    const items = [];
    for (const chunk of rawChunks) {
        const match = chunk.match(PILL_LABEL_RE);
        if (match) { items.push({ label: match[1].trim(), sep: match[2], text: match[3] }); }
        else if (items.length > 0 && !forceSeparate && !separated) {
            // Продолжение предыдущего предложения — дописываем в ту же пилюлю.
            items[items.length - 1].text += '. ' + chunk;
        }
        else { items.push({ label: '', sep: '', text: chunk }); }
    }
    return items.map(item => {
        const labelHtml = item.label ? `<span class="hud-pill-label">${escapeHtml(item.label)}${escapeHtml(item.sep)}</span> ` : '';
        return `<div class="${pillClass}">${labelHtml}${applyTooltips(item.text)}</div>`;
    }).join('');
}

// Канонизация ключей HUD: модель присылает и короткие коды ('T', 'Wth'),
// и русские/английские названия. Нужна и парсеру, и рендеру карточек.
export function mapKey(k) {
  const raw = String(k ?? '').trim();
  const n = raw.toLowerCase().replace(/[ё]/g, 'е').replace(/[\s_-]+/g, ' ');
  const map = {
    't':'Время','время':'Время','time':'Время',
    'wth':'Погода','погода':'Погода','weather':'Погода',
    'dt':'Дата','дата':'Дата','date':'Дата',
    'atm':'Атмосфера','атмосфера':'Атмосфера','atmosphere':'Атмосфера',
    'md':'Настроение','настроение':'Настроение','mood':'Настроение',
    'n':'Имя','имя':'Имя','name':'Имя',
    'a':'Возраст','возраст':'Возраст','age':'Возраст',
    'c':'Одежда','одежда':'Одежда','clothing':'Одежда','outfit':'Одежда',
    'ap':'Внешность','внешность':'Внешность','appearance':'Внешность',
    'h':'Здоровье','здоровье':'Здоровье','health':'Здоровье',
    'r':'Роль','роль':'Роль','role':'Роль',
    'b':'Тело','тело':'Тело','body':'Тело',
    'ph':'Физиология','физиология':'Физиология','physiology':'Физиология',
    'l':'Место','место':'Место','location':'Место','place':'Место',
    'th':'Мысли','мысли':'Мысли','thoughts':'Мысли','thought':'Мысли',
    'k':'Ключ','ключ':'Ключ','key':'Ключ',
    'exp':'Ожидание vs Реальность','ожидание vs реальность':'Ожидание vs Реальность','expectation vs reality':'Ожидание vs Реальность','expectation':'Ожидание vs Реальность',
    'd':'Скрытый подтекст','скрытый подтекст':'Скрытый подтекст','subtext':'Скрытый подтекст','hidden subtext':'Скрытый подтекст',
    'i':'Инвентарь','инвентарь':'Инвентарь','inventory':'Инвентарь',
    'g':'Цели','цели':'Цели','goals':'Цели','goal':'Цели',
    's':'Расписание','расписание':'Расписание','schedule':'Расписание',
    'rel':'Отношения','отношения':'Отношения','relationships':'Отношения','relationship':'Отношения',
    'mem':'Общие воспоминания','общие воспоминания':'Общие воспоминания','memories':'Общие воспоминания','shared memories':'Общие воспоминания',
    'flag':'Флаг-монитор','флаг-монитор':'Флаг-монитор','flag-monitor':'Флаг-монитор','flags':'Флаг-монитор',
    'st':'Статус','статус':'Статус','status':'Статус',
    'jls':'Ревность','ревность':'Ревность','jealousy':'Ревность','jealous':'Ревность',
    'exo':'Социальное разоблачение','социальное разоблачение':'Социальное разоблачение','social exposure':'Социальное разоблачение',
    'x':'Глубина конфликта','глубина конфликта':'Глубина конфликта','conflict depth':'Глубина конфликта','conflict':'Глубина конфликта',
    'sexlast':'Последний секс','последний секс':'Последний секс','last sex':'Последний секс',
    'sexcount':'Количество партнеров','количество партнеров':'Количество партнеров','partner count':'Количество партнеров','sex count':'Количество партнеров',
    'sexreg':'Регулярность секса','регулярность секса':'Регулярность секса','sex regularity':'Регулярность секса',
    'nsfw det':'Детализация NSFW','nsfw_det':'Детализация NSFW','детализация nsfw':'Детализация NSFW','nsfw details':'Детализация NSFW',
    'sexrev':'Отзыв о сексе','отзыв о сексе':'Отзыв о сексе','sex review':'Отзыв о сексе',
    'w':'NSFW','nsfw':'NSFW',
    'kink':'Кинк','кинк':'Кинк','kinks':'Кинк','кинки':'Кинк',
    'fet':'Фетиш','фетиш':'Фетиш','fetish':'Фетиш','fetishes':'Фетиш','фетиши':'Фетиш',
    'nogo':'Никогда не сделает','никогда не сделает':'Никогда не сделает','no go':'Никогда не сделает','hard limits':'Никогда не сделает','limits':'Никогда не сделает','hardlimits':'Никогда не сделает',
    'noturn':'Не возбуждает','не возбуждает':'Не возбуждает','turn offs':'Не возбуждает','turnoffs':'Не возбуждает','turn off':'Не возбуждает','antikinks':'Не возбуждает','anti kinks':'Не возбуждает',
    'dr':'Сновидение','сновидение':'Сновидение','dream':'Сновидение','dreams':'Сновидение',
    'uw':'NSFW (Юзер)','nsfw (юзер)':'NSFW (Юзер)','nsfw (user)':'NSFW (Юзер)','user nsfw':'NSFW (Юзер)'
  };
  return map[n] || raw;
}

// Ноль-ширинный пробел после первой буквы: не даёт World Info поймать
// имя из HUD как ключевое слово и активировать лорбук.
export function defeatWI(text) {
    if (!text || typeof text !== 'string' || text.length < 2) return text;
    return text.charAt(0) + '\u200B' + text.slice(1);
}
