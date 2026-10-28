// hud-manager/render/music-free.js
//
// Фон сцены целиком (render/music.js): очередь полных треков по настроению
// сцены из HUD — без запроса к модели. Источники, проверенные из России
// (октябрь 2026):
//   • Фонау (fonau.ru) — российская библиотека без отчислений, ~80 тыс.
//     треков; ищет по-русски через открытый REST API сайта (WordPress отдаёт
//     данные браузеру), mp3 лежат в облаке СберКлауда;
//   • Audius — открытый стриминг (инди, электроника, саундтреки), API без
//     ключа; берём только треки с открытым потоком;
//   • Incompetech (Кевин Маклауд) — музыка для кино и игр с разметкой по
//     «ощущению» (render/music-incompetech.js, CC BY);
//   • Wikimedia Commons — старинная музыка и классика в свободном доступе:
//     для средневековья.
// Не подошли: Jamendo и Internet Archive (из России закрыты), Openverse,
// Musopen, Pixabay (403), API Free Music Archive (закрыт), ccMixter (не отдаёт
// данные браузеру). Наружу уходят только слова настроения — ни текста чата,
// ни имён.

const нижн = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');

// Род настроения сцены (music.js, родНастроения) → слова поиска: по-русски
// для Фонау, по-английски для Audius, «ощущения» каталога Incompetech.
export const НАСТРОЕНИЯ_ФОНА = {
  страх: { ru: ['тревожная', 'напряженная', 'мрачная'], en: ['dark ambient', 'suspense', 'horror ambient'], feel: ['Eerie', 'Unnerving', 'Suspenseful', 'Dark'] },
  ярость: { ru: ['агрессивная', 'напряженная', 'энергичная'], en: ['aggressive', 'intense', 'dark trap'], feel: ['Aggressive', 'Intense', 'Action'] },
  грусть: { ru: ['грустная', 'меланхоличная', 'печальная'], en: ['sad piano', 'melancholy', 'emotional'], feel: ['Somber', 'Dark', 'Calming'] },
  страсть: { ru: ['чувственная', 'романтичная', 'страстная'], en: ['sensual', 'romantic', 'rnb chill'], feel: ['Relaxed', 'Grooving', 'Mystical'] },
  нежность: { ru: ['нежная', 'романтичная', 'уютная'], en: ['romantic piano', 'tender', 'lofi chill'], feel: ['Calming', 'Relaxed', 'Bright'] },
  веселье: { ru: ['веселая', 'позитивная', 'беззаботная'], en: ['happy', 'upbeat', 'funny'], feel: ['Bouncy', 'Bright', 'Humorous', 'Uplifting'] },
  тайна: { ru: ['загадочная', 'таинственная', 'мистическая'], en: ['mysterious', 'mystery', 'ethereal'], feel: ['Mysterious', 'Mystical', 'Eerie'] },
  подъём: { ru: ['эпичная', 'вдохновляющая', 'героическая'], en: ['epic orchestral', 'inspiring', 'cinematic'], feel: ['Epic', 'Uplifting', 'Driving'] },
  неловкость: { ru: ['забавная', 'неловкая', 'комедийная'], en: ['quirky', 'funny', 'comedy'], feel: ['Humorous', 'Bouncy'] },
  покой: { ru: ['спокойная', 'расслабляющая', 'медитативная'], en: ['ambient chill', 'calm', 'peaceful'], feel: ['Calming', 'Relaxed'] },
};
const БОЙ = { ru: ['эпичная битва', 'экшн', 'напряженная'], en: ['epic battle', 'action', 'intense'], feel: ['Action', 'Intense', 'Aggressive', 'Epic'] };
const ПО_УМОЛЧАНИЮ = { ru: ['кинематографичная', 'атмосферная', 'эмбиент'], en: ['cinematic', 'ambient', 'atmospheric'], feel: ['Mysterious', 'Calming', 'Relaxed'] };
const НОЧЬ = { ru: ['ночная'], en: ['night'] };
const ДОЖДЬ = { ru: ['дождь'], en: ['rain'] };
// Старинные инструменты Incompetech — для средневековья. Арфы и скрипки нет:
// они и в обычном оркестре. Лютня — словом: «flute» тоже кончается на «lute».
const СТАРИННЫЕ = /(?<![a-z])lutes?(?![a-z])|recorder|hurdy|bagpipe|harpsichord|dulcimer|renaissance|autoharp/;
const ЗАПРОСЫ_COMMONS_СРЕДНЕВЕКОВЬЕ = ['medieval music', 'renaissance lute', 'medieval dance', 'gregorian chant'];

/** Что искать для сцены: слова по родам настроения, бою, ночи и дождю. */
export function запросФона(сцена) {
  const с = сцена || {};
  const основа = с.бой ? БОЙ : (НАСТРОЕНИЯ_ФОНА[с.род] || ПО_УМОЛЧАНИЮ);
  const ru = [...основа.ru], en = [...основа.en];
  if (/дожд|ливень|rain/i.test(с.погода || '')) { ru.unshift(...ДОЖДЬ.ru); en.push(...ДОЖДЬ.en); }
  if (с.часть === 'ночь') { ru.push(...НОЧЬ.ru); en.push(...НОЧЬ.en); }
  return { эра: с.эра === 'medieval' ? 'medieval' : 'modern', род: с.бой ? 'бой' : (с.род || ''), ru: [...new Set(ru)].slice(0, 4), en: [...new Set(en)].slice(0, 4), feel: основа.feel };
}

// --- Сеть -----------------------------------------------------------------------
const ждать = (мс, внешний) => {
  const c = new AbortController();
  const т = setTimeout(() => c.abort(), мс);
  if (внешний) внешний.addEventListener('abort', () => c.abort(), { once: true });
  c.signal.addEventListener('abort', () => clearTimeout(т), { once: true });
  return c.signal;
};
const json = (url, signal) => fetch(url, { signal: ждать(9000, signal), credentials: 'omit', referrerPolicy: 'no-referrer' })
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
const сущности = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(+c)).replace(/&#x([\da-f]+);/gi, (_, c) => String.fromCodePoint(parseInt(c, 16)))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();

// Фонау: записи «station» — синглы с mp3 (meta.stream) и альбомы; берём синглы.
// Название — «Исполнитель – Трек».
export function трекиФонау(ответ) {
  return (Array.isArray(ответ) ? ответ : []).filter(x => x && x.meta && x.meta.type === 'single' && /^https:\/\/[\w.-]+\//.test(String(x.meta.stream || ''))).map(x => {
    const название = сущности(x.title && x.title.rendered);
    const [a, ...t] = название.split(/\s+[–—-]\s+/);
    return { a: t.length ? a : 'Фонау', t: t.length ? t.join(' – ') : название, поток: String(x.meta.stream), src: 'fonau', сек: Math.round((Number(x.meta.duration) || 0) / 1000) };
  // Джинглы и заставки по 10 секунд — не фон.
  }).filter(т => !т.сек || т.сек > 60);
}
async function изФонау(слова, signal) {
  const out = [];
  for (const слово of слова.slice(0, 2)) {
    const p = new URLSearchParams({ search: слово, per_page: '20', _fields: 'id,title,meta.type,meta.stream,meta.duration' });
    try { out.push(...трекиФонау(await json('https://fonau.ru/wp-json/wp/v2/station?' + p, signal))); } catch (e) { if (signal && signal.aborted) throw e; }
  }
  return out;
}

// Audius: только треки с открытым потоком; поток — через API (адрес на хранилище
// он отдаёт переадресацией, свежий при каждом нажатии).
export const AUDIUS = 'https://api.audius.co/v1';
const ПРИЛОЖЕНИЕ = 'TavernOS-HUD';
export function трекиAudius(ответ) {
  return (Array.isArray(ответ && ответ.data) ? ответ.data : []).filter(т => т && т.id && т.access && т.access.stream === true && (!т.duration || т.duration >= 60)).map(т => ({
    a: String(т.user && т.user.name || 'Audius').trim().slice(0, 60), t: String(т.title || '').trim().slice(0, 100),
    поток: AUDIUS + '/tracks/' + encodeURIComponent(т.id) + '/stream?app_name=' + ПРИЛОЖЕНИЕ,
    art: т.artwork && /^https:\/\//.test(String(т.artwork['150x150'] || '')) ? String(т.artwork['150x150']) : '',
    src: 'audius', сек: Number(т.duration) || 0, жанр: [т.genre, т.mood].filter(Boolean).join(', '),
  }));
}
async function изAudius(слова, signal) {
  const out = [];
  for (const слово of слова.slice(0, 2)) {
    try { out.push(...трекиAudius(await json(AUDIUS + '/tracks/search?' + new URLSearchParams({ query: слово, app_name: ПРИЛОЖЕНИЕ }), signal))); } catch (e) { if (signal && signal.aborted) throw e; }
  }
  return out;
}

// Incompetech: по «ощущениям» сцены; в средневековье — старинные инструменты.
export function трекиIncompetech(каталог, mp3, { feel = [], эра = 'modern' } = {}, случай = Math.random) {
  const нужно = feel.map(нижн);
  const оценки = (Array.isArray(каталог) ? каталог : []).map(([название, файл, ощущения, инструменты, сек]) => {
    const о = нижн(ощущения).split(',');
    let очки = нужно.filter(f => о.includes(f)).length;
    if (эра === 'medieval') очки = СТАРИННЫЕ.test(инструменты) || о.includes('medieval') || о.includes('ren faire') ? очки + 3 : -1;
    return { очки, т: { a: 'Kevin MacLeod', t: название, поток: mp3 + encodeURIComponent(файл) + '.mp3', src: 'incompetech', сек: Number(сек) || 0, жанр: ощущения.replace(/,/g, ', ') } };
  // Короткие нарезки («(60 second)») — не фон.
  }).filter(x => x.очки > 0 && (!x.т.сек || x.т.сек > 60) && !/\(\d+ seconds?\)/i.test(x.т.t));
  // Лучшие по совпадению, внутри — вперемешку: фон не должен повторяться ход за ходом.
  оценки.sort((a, b) => b.очки - a.очки || случай() - 0.5);
  return оценки.slice(0, 40).sort(() => случай() - 0.5).slice(0, 12).map(x => x.т);
}
async function изIncompetech(запрос) {
  const { КАТАЛОГ_INCOMPETECH, MP3_INCOMPETECH } = await import('./music-incompetech.js?v=23.86.0');
  return трекиIncompetech(КАТАЛОГ_INCOMPETECH, MP3_INCOMPETECH, запрос);
}

// Wikimedia Commons: аудиофайлы (ogg, opus, mp3; не MIDI) по запросу.
export function трекиCommons(ответ) {
  const страницы = ответ && ответ.query && ответ.query.pages ? Object.values(ответ.query.pages) : [];
  return страницы.map(p => ({ p, i: p && Array.isArray(p.imageinfo) ? p.imageinfo[0] : null }))
    .filter(({ i }) => i && /^https:\/\/upload\.wikimedia\.org\//.test(String(i.url || '')) && /^(audio\/(ogg|mpeg|opus|webm|flac)|application\/ogg)/.test(String(i.mime || '')) && !/midi/.test(String(i.mime)))
    .filter(({ i }) => !i.size || i.size > 300000)
    .map(({ p, i }) => {
      const имя = String(p.title || '').replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ');
      const [a, ...t] = имя.split(/\s+[–—-]\s+/);
      return { a: t.length ? a.slice(0, 60) : 'Wikimedia Commons', t: (t.length ? t.join(' – ') : имя).slice(0, 100), поток: String(i.url).replace(/\?.*$/, ''), src: 'commons' };
    });
}
async function изCommons(эра, signal) {
  if (эра !== 'medieval') return [];
  const out = [];
  for (const q of ЗАПРОСЫ_COMMONS_СРЕДНЕВЕКОВЬЕ.slice(0, 2)) {
    const p = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: q + ' filetype:audio', gsrnamespace: '6', gsrlimit: '20', prop: 'imageinfo', iiprop: 'url|mime|size', format: 'json', origin: '*' });
    try { out.push(...трекиCommons(await json('https://commons.wikimedia.org/w/api.php?' + p, signal))); } catch (e) { if (signal && signal.aborted) throw e; }
  }
  return out;
}

// Через один из каждого источника: фон не залипает на одном звучании.
export function вперемешку(списки, предел = 24) {
  const out = [], видели = new Set();
  const очереди = списки.map(с => [...с]);
  while (out.length < предел && очереди.some(о => о.length)) {
    for (const о of очереди) {
      const т = о.shift();
      if (!т) continue;
      const k = нижн(т.a + '|' + т.t);
      if (видели.has(k)) continue;
      видели.add(k);
      out.push(т);
      if (out.length >= предел) break;
    }
  }
  return out;
}

/**
 * Очередь фона для сцены. источники — какие включены: { fonau, audius,
 * incompetech, commons }. В средневековье — Incompetech со старинными
 * инструментами и Commons; современные стриминги не к месту.
 */
export async function собратьФон(сцена, { источники = {}, signal = null } = {}) {
  const з = запросФона(сцена);
  const вкл = (k) => источники[k] !== false;
  const средневековье = з.эра === 'medieval';
  const списки = await Promise.all([
    вкл('fonau') && !средневековье ? изФонау(з.ru, signal) : [],
    вкл('audius') && !средневековье ? изAudius(з.en, signal) : [],
    вкл('incompetech') ? изIncompetech(з).catch(() => []) : [],
    вкл('commons') ? изCommons(з.эра, signal) : [],
  ]);
  // Каждый источник — вперемешку внутри, потом через один.
  const перемешать = (с) => с.map(т => [Math.random(), т]).sort((a, b) => a[0] - b[0]).map(([, т]) => т);
  return { треки: вперемешку(списки.map(перемешать)), запрос: з };
}

export const ИМЕНА_ИСТОЧНИКОВ = { fonau: 'Фонау', audius: 'Audius', incompetech: 'Incompetech', commons: 'Wikimedia Commons' };
