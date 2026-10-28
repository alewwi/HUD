// hud-manager/render/music-lib.js
//
// Вкус и библиотека музыки (render/music.js), без сети и без страницы:
//   • сравнение треков (одна песня в разном написании — одна);
//   • «нравится» и «не предлагать» — подсказка модели и фильтр ответа;
//   • язык песен и мемный режим — строки правил для запроса;
//   • библиотека телефона персонажа: плейлисты с названиями и его
//     «Нравится» — в метаданных чата (chat_metadata.hud_phone_music).
//
// Два вкуса раздельно: «нравится» в полосе сцены — ваш вкус для саундтрека
// и музыки в сцене (settings.musicLiked); «Нравится» в приложении «Музыка»
// телефона — вкус этого персонажа, и в запросы его телефона идёт только он.

export const нижн = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');
export const норм = (s) => нижн(s).normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/&/g, ' and ').replace(/^the\s+/, '').replace(/[^\p{L}\d]+/gu, ' ').trim();
export const нормНазв = (s) => норм(String(s || '')
  .replace(/\s*[([].*?[)\]]\s*/g, ' ')
  .replace(/\s+[-–—]\s+.*?(?:remaster|version|live|edit|mix|mono|stereo|from\s).*$/i, '')
  .replace(/\s+(?:feat|ft)\.?\s.*$/i, ''));
export const ключТрека = (т) => норм(т && т.a) + '|' + нормНазв(т && т.t);

// --- Нравится / не предлагать -----------------------------------------------------
export const ПРЕДЕЛ_ЛАЙКОВ = 200;
export const ПРЕДЕЛ_ЗАПРЕТОВ = 300;

// В списке вкуса — только имя, название и обложка: ссылки и отрывки устаревают.
const кратко = (т) => ({ a: String(т.a), t: String(т.t), ...(т.art ? { art: String(т.art) } : {}) });

export const вСписке = (список, т) => !!т && (Array.isArray(список) ? список : []).some(x => x && ключТрека(x) === ключТрека(т));

/** Добавить трек в начало списка или убрать, если он там есть. */
export function переключить(список, т, предел) {
  const было = Array.isArray(список) ? список.filter(x => x && x.a && x.t) : [];
  if (!т || !т.a || !т.t) return { список: было, есть: false };
  const k = ключТрека(т);
  if (было.some(x => ключТрека(x) === k)) return { список: было.filter(x => ключТрека(x) !== k), есть: false };
  return { список: [кратко(т), ...было].slice(0, предел), есть: true };
}

/** Убрать из ответа модели то, что игрок просил не предлагать. */
export const безЗапрещённых = (треки, запреты) => (Array.isArray(треки) ? треки : []).filter(т => !вСписке(запреты, т));

const строкаТреков = (список, n) => (Array.isArray(список) ? список : []).slice(0, n).map(т => т.a + ' — ' + т.t).join('; ');

/**
 * Строки вкуса для запроса. чьи — 'player' (полоса сцены) или имя владельца
 * телефона: его «Нравится» — это его вкус, а не ваш.
 */
export function строкиВкуса({ лайки = [], запреты = [], чьи = 'player' } = {}) {
  const out = [];
  if (Array.isArray(лайки) && лайки.length) {
    out.push(чьи === 'player'
      ? 'The player liked these tracks — lean toward similar artists, genres and mood, but do not just repeat them: ' + строкаТреков(лайки, 15)
      : 'Tracks marked as liked in ' + чьи + "'s phone — this is " + чьи + "'s own taste, lean toward it, but do not just repeat them: " + строкаТреков(лайки, 15));
  }
  if (Array.isArray(запреты) && запреты.length) out.push('Never suggest these tracks (the player disliked them): ' + строкаТреков(запреты, 40));
  return out;
}

// --- Язык песен ---------------------------------------------------------------
export const ЯЗЫКИ_ПЕСЕН = [
  ['', 'Любой'], ['Russian', 'Русский'], ['English', 'English'], ['Japanese', '日本語'], ['Korean', '한국어'],
  ['French', 'Français'], ['German', 'Deutsch'], ['Spanish', 'Español'], ['Italian', 'Italiano'], ['Chinese', '中文'],
  ['custom', 'Свой'],
];
/** Язык песен по настройкам: '' — любой. */
export function языкПесен(s) {
  const v = String(s && s.musicLang || '');
  if (v === 'custom') return String(s.musicLangCustom || '').replace(/[^\p{L}\s-]/gu, '').trim().slice(0, 40);
  return ЯЗЫКИ_ПЕСЕН.some(([k]) => k === v) ? v : '';
}
/** Правило языка: для саундтрека и телефона — жёстко, для музыки в сцене — по месту. */
export function правилоЯзыка(язык, { сцена = true } = {}) {
  if (!язык) return '';
  return '- LANGUAGE (top priority, overrides the taste rules): every song with vocals must be sung in ' + язык
    + '. A fitting song in another language is a failure — pick one you are certain is sung in ' + язык + '. Instrumentals only when no ' + язык + ' song fits.'
    + (сцена ? ' Scene music: prefer ' + язык + ' songs when they are plausible for the place; otherwise what really plays there.' : '');
}

// --- Мемный режим ---------------------------------------------------------------
// Сцена смешная — по настроению, атмосфере и повороту сюжета.
const СМЕШНОЕ = /абсурд|комед|комич|нелеп|курь[её]з|фарс|уморит|смешн|ржач|ржут|хохо|кринж|глупо|глупост|прикол|дурачит|дурашл|балаган|цирк|клоун|abs(?:urd)|comed|comic|ridicul|silly|goofy|cringe|hilari|farce|slapstick|awkward fun/;
export const смешнаяСцена = (сцена) => !!сцена && СМЕШНОЕ.test(нижн([сцена.настроение, сцена.атмосфера, сцена.поворот].filter(Boolean).join(' ')));
/** Мемы в саундтреке: режим 'on' — всегда, 'auto' — в смешной сцене, 'off' — никогда. */
export function мемныйРежим(режим, сцена) {
  if (режим === 'on') return true;
  if (режим === 'auto') return смешнаяСцена(сцена);
  return false;
}
export const правилоМемов = (n) => '- soundtrack — MEME MODE: ' + n + ' famous meme sounds, viral audio and meme songs that hilariously underline, undercut or defuse this exact moment — sad trombone, "To Be Continued" (Roundabout), the Curb Your Enthusiasm theme, vine boom, Crab Rave, Rickroll, Megalovania, edit phonk and the like. Pick what fits what is literally happening; find fresh ones too. Everything must be findable on YouTube: "artist" — the source, show or meme name ("Meme" if unknown), "title" — the clear searchable name of the sound or song. The rule about commercially released recordings does not apply to the soundtrack in this mode.';

// --- Библиотека телефона ----------------------------------------------------------
export const КЛЮЧ_БИБЛИОТЕКИ = 'hud_phone_music';
export const ПРЕДЕЛ_ПЛЕЙЛИСТОВ = 40;
export const ПРЕДЕЛ_ТРЕКОВ_ПЛЕЙЛИСТА = 60;

/** Короткий устойчивый id из строки (имя владельца, время создания). */
export function idИз(s) {
  let h = 2166136261;
  for (const ch of String(s || '')) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36);
}

/** Библиотека из метаданных чата; создать — завести, если её нет. */
export function библиотека(meta, создать = false) {
  if (!meta || typeof meta !== 'object') return null;
  let б = meta[КЛЮЧ_БИБЛИОТЕКИ];
  if (!б || typeof б !== 'object' || !б.owners || typeof б.owners !== 'object') {
    if (!создать) return null;
    б = meta[КЛЮЧ_БИБЛИОТЕКИ] = { v: 1, owners: {} };
  }
  return б;
}

/** Запись владельца телефона: { id, playlists, liked }. */
export function записьВладельца(б, имя, создать = false) {
  const кто = String(имя || '').trim();
  if (!б || !кто) return null;
  let з = б.owners[кто];
  if (!з && создать) з = б.owners[кто] = { id: idИз(кто), playlists: [], liked: [] };
  if (з) {
    if (!Array.isArray(з.playlists)) з.playlists = [];
    if (!Array.isArray(з.liked)) з.liked = [];
    if (!з.id) з.id = idИз(кто);
  }
  return з || null;
}

/** Найти запись владельца по её id (группа проигрывания «Нравится»). */
export function записьПоId(б, id) {
  if (!б) return null;
  for (const [имя, з] of Object.entries(б.owners)) if (з && з.id === id) return { имя, з };
  return null;
}

/** Плейлист по id у любого владельца. */
export function плейлистПоId(б, id) {
  if (!б) return null;
  for (const [имя, з] of Object.entries(б.owners)) {
    const п = з && Array.isArray(з.playlists) ? з.playlists.find(x => x && x.id === id) : null;
    if (п) return { имя, з, п };
  }
  return null;
}

const безПовторовПо = (треки, уже = []) => {
  const видели = new Set(уже.map(ключТрека));
  return треки.filter(т => { const k = ключТрека(т); if (!т || !т.a || !т.t || видели.has(k)) return false; видели.add(k); return true; });
};

/** Новый плейлист в начало списка владельца. */
export function новыйПлейлист(з, { name, tracks, theme = '', mes = 0, at = Date.now() }) {
  const п = { id: idИз(at + ':' + name + ':' + Math.random()), name: String(name || 'Плейлист').trim().slice(0, 48), tracks: безПовторовПо(tracks || []).slice(0, ПРЕДЕЛ_ТРЕКОВ_ПЛЕЙЛИСТА), at, upd: at, mes };
  if (theme) п.theme = String(theme).trim().slice(0, 120);
  з.playlists = [п, ...з.playlists].slice(0, ПРЕДЕЛ_ПЛЕЙЛИСТОВ);
  return п;
}

/** Дописать в плейлист новые треки без повторов; вернуть, сколько добавилось. */
export function дописатьПлейлист(п, треки, mes = п.mes, at = Date.now()) {
  const новые = безПовторовПо(треки || [], п.tracks || []);
  п.tracks = [...(п.tracks || []), ...новые].slice(0, ПРЕДЕЛ_ТРЕКОВ_ПЛЕЙЛИСТА);
  п.upd = at;
  п.mes = mes;
  return новые.length;
}

export function удалитьПлейлист(з, id) {
  const было = з.playlists.length;
  з.playlists = з.playlists.filter(п => п && п.id !== id);
  return з.playlists.length < было;
}
