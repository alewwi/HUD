// hud-manager/utils.js
//
// Мелкие утилиты, общие для всех доменов HUD (дневник, мир, сны, телефон,
// граф отношений, память). Вынесено из index.js без изменения поведения.

/** Экранирование через DOM: браузер сам решает, что считать опасным. */
export function escapeHtml(str) { if (!str) return ''; const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }

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

export function buildPillList(value, pillClass, forceSeparate = false) {
    let items = [];
    let delimiter = String(value).includes(';') ? ';' : (String(value).includes('\n') ? '\n' : '. ');
    let rawChunks = String(value).split(delimiter).map(i => i.trim()).filter(i => i);
    for (let chunk of rawChunks) {
        let match = chunk.match(/^([A-Za-zА-Яа-яЁё0-9\s\/\(\),\.]{2,80}?)(:|—|–|\s-)\s*(.*)$/);
        if (match) { items.push({ label: match[1], sep: match[2], text: match[3] }); } 
        else {
            if (items.length > 0 && !forceSeparate) { items[items.length - 1].text += (delimiter === ';' ? '; ' : delimiter) + chunk; } 
            else { items.push({ label: '', sep: '', text: chunk }); }
        }
    }
    return items.map(item => {
        let labelHtml = item.label ? `<span class="hud-pill-label">${escapeHtml(item.label)}${escapeHtml(item.sep)}</span> ` : '';
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
    'exo':'Социальное разоблачение','социальное разоблачение':'Социальное разоблачение','social exposure':'Социальное разоблачение',
    'x':'Глубина конфликта','глубина конфликта':'Глубина конфликта','conflict depth':'Глубина конфликта','conflict':'Глубина конфликта',
    'sexlast':'Последний секс','последний секс':'Последний секс','last sex':'Последний секс',
    'sexcount':'Количество партнеров','количество партнеров':'Количество партнеров','partner count':'Количество партнеров','sex count':'Количество партнеров',
    'sexreg':'Регулярность секса','регулярность секса':'Регулярность секса','sex regularity':'Регулярность секса',
    'nsfw det':'Детализация NSFW','nsfw_det':'Детализация NSFW','детализация nsfw':'Детализация NSFW','nsfw details':'Детализация NSFW',
    'sexrev':'Отзыв о сексе','отзыв о сексе':'Отзыв о сексе','sex review':'Отзыв о сексе',
    'w':'NSFW','nsfw':'NSFW',
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
