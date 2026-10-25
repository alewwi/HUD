// hud-manager/chronicle.js
//
// Летопись чата: короткая выжимка каждого HUD, которая живёт в метаданных
// чата (chat_metadata), а не в сообщениях.
//
// Архив (history-analyzer.js) и счётчик дней сюжета (index.js) раньше брали
// всё из блоков [HUD] прямо в сообщениях. Игрок чистит старые сообщения от
// HUD, кодов и разметки — промпт легче, файл меньше, — и архив после этого
// видит только то, что осталось: дни считались с последнего уцелевшего HUD.
// Теперь каждый разобранный HUD оставляет в летописи то, что нужно архиву:
// дату, время, место, погоду, настроения, отношения, секреты и ружья. Чистка
// сообщений летопись не трогает.
//
// Хранится только изменившееся: секреты и отношения повторяются из хода в
// ход, и полная копия каждого хода раздула бы файл чата — ровно то, от чего
// игрок его чистит. Каждый ход — [ключ, разница с предыдущим]. Ключ —
// send_date сообщения: точная метка времени, общая у чата и его копий.
//
// Отдельно — даты из тегов самого текста: <time> 20:03|30.10.24 среда|…,
// <clock>, <date>. Это запасной источник дней, когда HUD нет ни в
// сообщении, ни в летописи.

export const КЛЮЧ_ЛЕТОПИСИ = 'tavernosHudChronicle';

const т = (v) => (v === null || v === undefined ? '' : String(v)).trim();
const пусто = (v) => !т(v) || /^(empty|none|n\/a|нет|-|—)$/i.test(т(v));
const или = (v) => (пусто(v) ? '' : т(v));

/** Ключ сообщения в летописи: send_date, у сообщения без неё — номер. */
export function ключСообщения(m, i) {
  const д = m && m.send_date;
  return д !== undefined && д !== null && String(д).trim() ? String(д).trim() : '#' + i;
}

// Человек: только то, что читает архив и его сводка.
function человек(c) {
  if (!c || typeof c !== 'object') return null;
  const имя = или(c['Имя'] || c.N || c.name);
  if (!имя) return null;
  const о = { Имя: имя };
  for (const [к, ч] of [['Настроение', c['Настроение'] || c.Md], ['Отношения', c['Отношения'] || c.Rel], ['Место', c['Место']]]) if (или(ч)) о[к] = или(ч);
  // Близость — только признак: сам текст архиву не нужен.
  if (или(c['Фаза близости']) || или(c['NSFW']) || или(c['NSFW (Юзер)'])) о.NSFW = '1';
  return о;
}

/** Выжимка разобранного HUD (normalizeJSONData) — в той же форме, что его
 *  читает архив: scene, user, characters, memory.secrets, memory.guns.
 *  музыка — краткая подборка хода (render/music-data.js), если она есть. */
export function выжимкаHUD(data, музыка = null) {
  if (!data || typeof data !== 'object') return null;
  const sc = data.scene && typeof data.scene === 'object' ? data.scene : {};
  const scene = {};
  for (const к of ['Дата', 'Время', 'Место', 'Погода']) if (или(sc[к])) scene[к] = или(sc[к]);
  const user = человек(data.user);
  const characters = (Array.isArray(data.characters) ? data.characters : []).map(человек).filter(Boolean);
  const mem = data.memory && typeof data.memory === 'object' ? data.memory : {};
  const secrets = (Array.isArray(mem.secrets) ? mem.secrets : []).filter(s => s && или(s.fact)).map(s => {
    const о = { fact: т(s.fact) };
    if (или(s.level)) о.level = т(s.level);
    if (или(s.status)) о.status = т(s.status);
    const знают = (Array.isArray(s.knows) ? s.knows : []).map(k => ({ name: т(k && (k.name || k.n)), source: т(k && (k.source || k.src)) })).filter(k => k.name);
    if (знают.length) о.knows = знают;
    const не = (Array.isArray(s.hidden) ? s.hidden : []).map(т).filter(Boolean);
    if (не.length) о.hidden = не;
    return о;
  });
  const guns = (Array.isArray(mem.guns) ? mem.guns : []).map(т).filter(Boolean);
  // Трекер настроений: только «сейчас» игрока и главного персонажа.
  const mood = {};
  for (const кто of ['user', 'char']) { const x = mem.mood && mem.mood[кто]; const сейчас = или(x && (x.current ?? x.nw)); if (сейчас) mood[кто] = { current: сейчас }; }
  const выжимка = { scene };
  if (user) выжимка.user = user;
  выжимка.characters = characters;
  выжимка.memory = { secrets, guns, mood };
  if (музыка) выжимка.music = музыка;
  return выжимка;
}

// Части выжимки, которые хранятся разницей: меняется одна — пишется одна.
// Музыка (mu) одна на всю сцену — пишется, только когда сменилась подборка.
const ЧАСТИ = { sc: (в) => в.scene, us: (в) => в.user || null, cs: (в) => в.characters, sec: (в) => в.memory.secrets, gun: (в) => в.memory.guns, md: (в) => в.memory.mood || {}, mu: (в) => в.music || null };
function собрать(части) {
  return { scene: части.sc || {}, ...(части.us ? { user: части.us } : {}), characters: части.cs || [], memory: { secrets: части.sec || [], guns: части.gun || [], mood: части.md || {} }, ...(части.mu ? { music: части.mu } : {}) };
}

/** Летопись из метаданных чата: Map ключ → выжимка, в порядке ходов. */
export function прочитатьЛетопись(meta) {
  const л = meta && meta[КЛЮЧ_ЛЕТОПИСИ];
  const out = new Map();
  if (!л || !Array.isArray(л.ходы)) return out;
  let текущие = {};
  for (const ход of л.ходы) {
    if (!Array.isArray(ход) || ход.length < 2 || !ход[1] || typeof ход[1] !== 'object') continue;
    текущие = { ...текущие, ...ход[1] };
    out.set(String(ход[0]), собрать(текущие));
  }
  return out;
}

/**
 * Дописать в летопись выжимки ходов. порядок — ключи сообщений чата сейчас,
 * по порядку: новый ход встаёт после ближайшего предыдущего сообщения, уже
 * записанного. Ходы, которых в чате больше нет (сообщения удалили), летопись
 * хранит: архив прошлых дней не должен пропадать от уборки чата.
 * Возвращает true, если что-то изменилось.
 */
export function дописатьЛетопись(meta, новые, порядок = []) {
  if (!meta || !новые || !новые.size) return false;
  const было = прочитатьЛетопись(meta);
  let изменено = false;
  const ключи = [...было.keys()];
  const место = new Map(порядок.map((к, i) => [к, i]));
  for (const [к, выж] of новые) {
    if (!выж) continue;
    if (было.has(к) && JSON.stringify(было.get(к)) === JSON.stringify(выж)) continue;
    изменено = true;
    if (!было.has(к)) {
      // После последнего записанного хода, который в чате стоит раньше этого.
      const мой = место.has(к) ? место.get(к) : Infinity;
      let после = -1;
      ключи.forEach((x, j) => { if ((место.has(x) ? место.get(x) : -1) < мой) после = j; });
      ключи.splice(после + 1, 0, к);
    }
    было.set(к, выж);
  }
  if (!изменено) return false;
  const ходы = [];
  let прошлые = {};
  for (const к of ключи) {
    const выж = было.get(к);
    const разница = {};
    for (const [имя, взять] of Object.entries(ЧАСТИ)) {
      const ч = взять(выж);
      if (JSON.stringify(ч) !== JSON.stringify(прошлые[имя] ?? (имя === 'us' || имя === 'mu' ? null : undefined))) разница[имя] = ч;
      прошлые[имя] = ч;
    }
    ходы.push([к, разница]);
  }
  meta[КЛЮЧ_ЛЕТОПИСИ] = { v: 1, ходы };
  return true;
}

// Дата и время из тегов текста. Только из тегов, а не из прозы: в тексте
// дат полно — письма, воспоминания, расписания.
const ТЕГ_ВРЕМЕНИ = /<(time|clock|date|дата|время)\b[^>]*>([\s\S]{1,240}?)<\/\1>|<(time|clock|date)\b[^>]*>\s*([^<]{4,240})/giu;
const ДАТА = /(\d{1,2})[./](\d{1,2})[./](\d{2,4})|(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2})\s+(январ|феврал|март|апрел|ма[яй]|июн|июл|август|сентябр|октябр|ноябр|декабр)\p{L}*(?:\s+(\d{4}))?|(?<![\p{L}\d])\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?![\p{L}])\.?,?(?:\s+\d{4})?|(?<![\p{L}])(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?![\d\p{L}])(?:,?\s+\d{4})?/iu;
const ВРЕМЯ = /(?<!\d)([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)/;
/** «<time> 20:03|30.10.24 среда|37°F…</time>» → { дата: '30.10.24', время: '20:03' }; нет — null. */
export function датаИзТегов(текст) {
  const s = String(текст || '');
  for (const м of s.matchAll(ТЕГ_ВРЕМЕНИ)) {
    const внутри = (м[2] || м[4] || '').replace(/<[^>]+>/g, ' ');
    const д = внутри.match(ДАТА);
    if (!д) continue;
    // Время до даты, если оно там есть: «20:03|30.10.24».
    const в = внутри.replace(д[0], ' ').match(ВРЕМЯ);
    return { дата: д[0], время: в ? в[1].padStart(2, '0') + ':' + в[2] : '' };
  }
  return null;
}
