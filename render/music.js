// hud-manager/render/music.js
//
// Музыка сцены: подборка треков к ходу по данным HUD.
//
// HUD уже знает сцену по полочкам — место, время, погоду, настроение,
// близость, бой, эпоху. Поэтому подборка — отдельный маленький запрос
// (выжимка сцены и кусок последнего ответа), а не пересказ пятнадцати
// сообщений. Новый запрос — только при смене сцены и по кнопке: пока сцена
// та же, ход получает копию прежней подборки и ничего не тратит.
//
// Своего плеера нет (первый шаг): у трека ссылки на поиск в Яндекс Музыке,
// Spotify и YouTube, а если стоит MoodTube — кнопка «в очередь». Треки
// сверяются поиском iTunes: найденный получает обложку и точное написание,
// ненайденный помечается — модели любят выдумывать песни.
//
// Подборка лежит в message.extra.hud_music — у каждого свайпа своя, как
// версии HUD, и сохраняется в файле чата. Запрос идёт с флагом
// window.__tavernOSHudSkipInject: инструкция HUD в него не попадает.

import { escapeHtml, hudHasMeaningfulValue, имяБезПриставки, генерацияТаверны } from '../utils.js?v=23.88.4';
import { settings } from '../settings.js?v=23.88.4';
import { parseHUDComplex } from '../hud-parser.js?v=23.88.4';
import { hudБлоки, заменитьHudБлоки } from '../hud-block.js?v=23.88.4';
import { hudHasCombat } from './combat.js?v=23.88.4';
import { музыкаХода, сохранитьМузыку, номерСвайпа } from './music-data.js?v=23.88.4';
import { английский } from '../i18n.js?v=23.88.4';
import { дописатьВЛетопись, выжимкаСообщения } from '../chronicle-store.js?v=23.88.4';
import { ключСообщения } from '../chronicle.js?v=23.88.4';
import { норм, нормНазв, ключТрека, вСписке, переключить, безЗапрещённых, строкиВкуса, языкПесен, правилоЯзыка, мемныйРежим, правилоМемов,
  ПРЕДЕЛ_ЛАЙКОВ, ПРЕДЕЛ_ЗАПРЕТОВ, библиотека, записьВладельца, записьПоId, плейлистПоId, новыйПлейлист, дописатьПлейлист, удалитьПлейлист } from './music-lib.js?v=23.88.4';
import { станцииСцены } from './music-radio.js?v=23.88.4';
import { собратьФон, ИМЕНА_ИСТОЧНИКОВ } from './music-free.js?v=23.88.4';

export { музыкаХода, норм, нормНазв };

const КЛЮЧ_ПРОМПТА = 'hud_music_scene';
// Свежим считается ход, пришедший в этой вкладке не раньше чем 10 минут назад:
// открытие старого чата подборок не заказывает.
const СВЕЖЕСТЬ_МС = 10 * 60 * 1000;

let основа = null;
let подключено = false;
const свежие = new Map();   // mesId → когда пришёл
const идут = new Map();     // ключ хода → AbortController
const ошибки = new Map();   // ключ хода → текст ошибки

const контекст = () => { try { return window.SillyTavern?.getContext?.() || null; } catch (_) { return null; } };
const есть = (v) => hudHasMeaningfulValue(v);
const плоско = (v) => {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map(плоско).filter(Boolean).join('; ');
  if (typeof v === 'object') return Object.values(v).map(плоско).filter(Boolean).join('; ');
  return String(v).replace(/\s+/g, ' ').trim();
};
const поле = (v) => (есть(v) ? плоско(v) : '');
const обрезать = (s, n) => { const t = String(s || '').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const нижн = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');

// ---------------------------------------------------------------------------
// СЦЕНА: что из HUD решает, нужна ли новая подборка
// ---------------------------------------------------------------------------

// Место — набором основ слов: модель каждый ход пишет его по-своему
// («Квартира Лилиан, гостиная» → «гостиная квартиры Лилиан»), и строгое
// сравнение заказывало бы музыку на каждом ходу.
export const основыМеста = (s) => [...new Set((нижн(s).match(/[\p{L}\d]{4,}/gu) || []).map(w => w.slice(0, 5)))];
function похожиеМеста(a, b) {
  const A = new Set(a || []), B = new Set(b || []);
  if (!A.size || !B.size) return true;
  let общих = 0;
  for (const x of A) if (B.has(x)) общих++;
  return общих / Math.min(A.size, B.size) >= 0.5;
}

export function частьСуток(t) {
  const s = нижн(t);
  const m = s.match(/(\d{1,2})[:.](\d{2})/);
  if (m) { const ч = +m[1]; return ч >= 22 || ч < 5 ? 'ночь' : ч < 17 ? 'день' : 'вечер'; }
  if (/ноч|полноч|night|midnight/.test(s)) return 'ночь';
  if (/вечер|закат|even|sunset|dusk/.test(s)) return 'вечер';
  if (/утр|рассвет|дн[её]м|день|полд|morn|dawn|day|noon/.test(s)) return 'день';
  return '';
}

// Настроение — родом, а не словом: «тревожное» и «напряжённое» — одна музыка.
const НАСТРОЕНИЯ = [
  ['страх', /страх|ужас|жут|тревож|тревог|опасн|паник|угроз|напряж|fear|dread|tense|danger|horror|anxi/],
  ['ярость', /ярост|гнев|злост|злой|агресс|бешен|rage|anger|angry|fury/],
  ['грусть', /груст|печал|тоск|скорб|горе|сл[её]з|одиноч|меланх|мрачн|угрюм|sad|grief|lonely|melanchol|sorrow/],
  ['страсть', /страст|возбужд|похот|эрот|чувствен|lust|passion|sensual|erotic|aroused/],
  ['нежность', /нежн|романт|ласк|уют|любов|tender|romantic|cozy|love/],
  ['веселье', /весел|радост|игрив|смех|праздн|азарт|беззабот|cheer|joy|playful|fun|festive|happy/],
  ['тайна', /таинств|загадоч|мистич|интриг|подозр|mysteri|intrigu|eerie|suspic/],
  ['подъём', /торжеств|эпич|триумф|воодушев|решительн|epic|triumph|heroic/],
  ['неловкость', /неловк|смущ|awkward|embarrass/],
  ['покой', /спокой|умиротвор|тих|сонн|расслаб|ленив|calm|peace|quiet|relax|serene|sleepy/],
];
export function родНастроения(s) { const t = нижн(s); const н = НАСТРОЕНИЯ.find(([, rx]) => rx.test(t)); return н ? н[0] : ''; }

const НЕТ_БЛИЗОСТИ = /^(?:нет|none|no|off|вне сцены|нет сцены|—|-|n\/a)$/i;

/** Сцена из разобранного HUD: то, по чему сравниваем, и то, что уйдёт в запрос. */
export function сценаИзHUD(data, эра = settings.era) {
  const d = data && typeof data === 'object' ? data : {};
  const sc = d.scene || {};
  const люди = (Array.isArray(d.characters) ? d.characters : []).filter(c => c && typeof c === 'object');
  const место = поле(люди[0] && люди[0]['Место']) || поле(d.user && d.user['Место']);
  const близость = люди.some(c => { const ф = поле(c['Фаза близости']); return ф && !НЕТ_БЛИЗОСТИ.test(ф); });
  return {
    эра: эра === 'medieval' ? 'medieval' : 'modern',
    место, основы: основыМеста(место),
    время: поле(sc['Время']), часть: частьСуток(поле(sc['Время'])),
    дата: поле(sc['Дата']), погода: поле(sc['Погода']),
    настроение: поле(sc['Настроение']), атмосфера: поле(sc['Атмосфера']),
    род: родНастроения(поле(sc['Настроение'])) || родНастроения(поле(sc['Атмосфера'])),
    близость, бой: hudHasCombat(d.combat),
    поворот: поле(sc['Поворот сюжета']),
    люди: люди.slice(0, 4).map(c => ({ имя: поле(c['Имя']), статус: обрезать(поле(c['Статус']), 90), близость: поле(c['Фаза близости']) })).filter(ч => ч.имя),
  };
}

/** Чем новая сцена отличается от той, под которую подобрана музыка; '' — ничем. */
export function чемОтличается(было, стало) {
  if (!было) return 'первая подборка';
  if (!стало) return '';
  if (было.эра !== стало.эра) return 'сменилась эпоха';
  if (!было.бой && стало.бой) return 'начался бой';
  if (было.бой && !стало.бой) return 'бой окончен';
  if (!было.близость && стало.близость) return 'началась близость';
  if (было.близость && !стало.близость) return 'близость позади';
  if (!похожиеМеста(было.основы, стало.основы)) return 'сменилось место';
  if ((было.часть === 'ночь') !== (стало.часть === 'ночь') && было.часть && стало.часть) return стало.часть === 'ночь' ? 'наступила ночь' : 'ночь прошла';
  if (было.род && стало.род && было.род !== стало.род) return 'сменилось настроение';
  return '';
}

// ---------------------------------------------------------------------------
// ЗАПРОС
// ---------------------------------------------------------------------------

/** Чей телефон: явный владелец, самый частый владелец переписок, первый
 *  персонаж. Без приставки карточки («THE REGENTS  Tristan» — Tristan). */
export function владелецТелефона(data) {
  const имя = владелецКакЕсть(data);
  return имя ? (имяБезПриставки(имя) || имя) : '';
}
function владелецКакЕсть(data) {
  const d = data && typeof data === 'object' ? data : {};
  const явный = поле(d.phone && d.phone.owner);
  if (явный) return явный;
  const голоса = {};
  for (const c of Object.values(d.chatsMap && typeof d.chatsMap === 'object' ? d.chatsMap : {})) { const о = поле(c && c.owner); if (о) голоса[о] = (голоса[о] || 0) + 1; }
  const частый = Object.keys(голоса).sort((a, b) => голоса[b] - голоса[a])[0];
  if (частый) return частый;
  return поле(Array.isArray(d.characters) && d.characters[0] && d.characters[0]['Имя']);
}

// Что знаем о владельце телефона для его вкуса: возраст, роль, состояние.
function оВладельце(data, владелец) {
  const c = (Array.isArray(data && data.characters) ? data.characters : []).find(x => x && поле(x['Имя']) && (поле(x['Имя']) === владелец || поле(x['Имя']).includes(владелец) || владелец.includes(поле(x['Имя']))));
  if (!c) return '';
  return [поле(c['Возраст']) && 'age ' + поле(c['Возраст']), обрезать(поле(c['Роль']), 120), обрезать(поле(c['Статус']), 120)].filter(Boolean).join('; ');
}

export const ЧАСТИ_МУЗЫКИ = ['soundtrack', 'scene', 'phone'];

/**
 * Запрос подборки. части — что подобрать: саундтрек, музыку в сцене, телефон
 * (телефон — только если передан владелец). Запрошенную отдельно музыку в
 * сцене модель обязана прислать: игрок сам попросил.
 */
/** Правила вкуса по умолчанию — их игрок правит в настройках («Промпт
 *  музыки»). Формат ответа, части плейлиста и эпоха остаются встроенными:
 *  без них ответ не разобрать. */
export const ПРАВИЛА_МУЗЫКИ = [
  '- Only real, commercially released recordings that can be found on streaming services. Never invent songs. If unsure a track exists, choose a better-known one. Original artist, exact title, no album names, no "feat." clutter.',
  '- The vibe decides, not the genre: songs with vocals and instrumentals are equally welcome — pop, rock, indie, hip-hop, electronic, folk, classical, score, whatever fits the mood, the setting and the characters. Mix them freely; do not default to ambient or piano.',
  '- At most 2 tracks per artist.',
].join('\n');

// Контекст истории для запроса: последние сообщения, карточка, персона, лорбуки.
const ПРЕДЕЛ_СООБЩЕНИЯ = 1500, ПРЕДЕЛ_ИСТОРИИ = 9000, ПРЕДЕЛ_ЛОРА = 5000;
function блокКонтекста(контекст) {
  if (!контекст) return [];
  const out = [];
  if (контекст.карточка) out.push('CHARACTER CARD (' + контекст.карточка.name + '):\n' + обрезать(контекст.карточка.text, 3000));
  if (контекст.персона) out.push('PLAYER PERSONA:\n' + обрезать(контекст.персона, 1200));
  const лор = (контекст.лор || []).flatMap(к => (к.entries || []).map(е => '- ' + String(е).replace(/\s+/g, ' ').trim()));
  if (лор.length) {
    let всего = 0;
    const взято = лор.filter(з => (всего += з.length) <= ПРЕДЕЛ_ЛОРА);
    out.push('LORE:\n' + взято.join('\n'));
  }
  return out;
}

// вкус — строки «нравится / не предлагать» игрока (music-lib.js, строкиВкуса);
// у телефона свой вкус — телефон.вкус. языкПесни — язык песен; мемы — мемный
// саундтрек; радио — к музыке в сцене теги станции и страна (music-radio.js).
export function промптМузыки({ сцена, проза = '', прежние = [], сколько = 8, средневековье = settings.musicMedieval, телефон = null, части = ['soundtrack', 'scene'], контекст = null, правила = null, пожелание = settings.musicWish, вкус = [], языкПесни = '', мемы = false, радио = false }) {
  const просьба = обрезать(плоско(пожелание || ''), 300);
  const нужно = new Set(части);
  if (!телефон) нужно.delete('phone');
  const толькоСцена = нужно.has('scene') && !нужно.has('soundtrack');
  // Подписи для интерфейса (метка, пояснения, где играет) — на его языке.
  const язык = английский() ? 'English' : 'Russian';
  const эпоха = сцена.эра === 'medieval'
    ? (средневековье === 'score'
      ? 'Setting: medieval. Soundtrack: modern orchestral film/TV/game scores for historical or fantasy stories. Scene music must still be period-plausible (lute, minstrels, chant, folk instruments).'
      : 'Setting: medieval. Soundtrack: authentic early music, medieval and renaissance ensembles, lute, hurdy-gurdy, folk and Celtic instrumentals — real recordings. Scene music must be period-plausible (lute, minstrels, chant, a tavern fiddler).')
    : 'Setting: modern (take the year from the date if given). Scene music must be plausible for that year, country and place.';
  const шаблон = ['"label":"..."',
    нужно.has('soundtrack') && '"soundtrack":[{"artist":"...","title":"...","why":"..."}]',
    нужно.has('scene') && (радио ? '"scene":{"source":"...","radio":"...","country":"..","tracks":[{"artist":"...","title":"..."}]}' : '"scene":{"source":"...","tracks":[{"artist":"...","title":"..."}]}'),
    нужно.has('phone') && '"phone":{"tracks":[{"artist":"...","title":"..."}]}'].filter(Boolean).join(',');
  const system = [
    // Начало: роль и запрет. Сообщения истории, карточка и лорбуки в запросе
    // похожи на ролевую — без этого модель принималась писать продолжение.
    'You are a music supervisor for an interactive story. You do NOT write, continue or roleplay the story, and you do not answer any character: you only choose music for the current moment.',
    'Everything inside <reference> in the user message — scene snapshot, story excerpt, character card, persona, lore — is background information about that moment. Read it, never continue it.',
    'Reply with ONLY one JSON object, no prose, no markdown:',
    '{' + шаблон + '}',
    'Rules:',
    String(правила ?? settings.musicPrompt ?? '').trim() || ПРАВИЛА_МУЗЫКИ,
    нужно.has('soundtrack') && (мемы ? правилоМемов(сколько + 3) : `- soundtrack: ${сколько + 3} tracks for the listener, like the soundtrack of a film or series at this exact moment, best match first.`),
    нужно.has('scene') && (толькоСцена
      ? '- scene: music the characters themselves can hear right now. The player asked for it, so always return 1-3 tracks: what plays or could plausibly play in that place (radio, venue, a speaker, a street musician, a bard). "source" — where it plays, 2-5 words in ' + язык + '.'
      : '- scene: music the characters themselves can hear right now (car radio, club, bar pianist, street musician, tavern bard, a phone speaker). Only when the snapshot or the text implies music is playing or plausible in that place; otherwise "scene": null. 1-3 tracks. "source" — where it plays, 2-5 words in ' + язык + '.'),
    нужно.has('scene') && радио && '- radio: when the scene music comes from a radio, a venue\'s speakers or a stream, 1-3 English style tags of such a station for an internet radio directory (e.g. "russian pop", "80s", "lo-fi", "jazz", "rock", "chanson", "slow romantic"); otherwise null. country: ISO 3166 two-letter code of the country the scene is in.',
    нужно.has('phone') && '- phone: what ' + телефон.владелец + ' personally listens to on their own phone — 6 tracks, most recently played first. Their own taste by age, background, personality and state, not the scene score. Songs with vocals are fine.' + (телефон.прежние.length ? ' Keep most of their library from before and change 1-3 tracks to reflect the moment.' : ''),
    ...вкус.map(с => '- ' + с),
    ...(нужно.has('phone') && Array.isArray(телефон.вкус) ? телефон.вкус.map(с => '- phone: ' + с) : []),
    '- label: 2-5 lowercase ' + язык + ' words naming the moment for the interface, e.g. ' + (английский() ? '"rainy night in the car"' : '"дождливая ночь в машине"') + '.',
    нужно.has('soundtrack') && '- why: at most 8 ' + язык + ' words.',
    '- ' + эпоха,
    правилоЯзыка(языкПесни),
    просьба && "- The player's wish in the user message has top priority: follow it for the soundtrack" + (нужно.has('phone') ? ' and the phone' : '') + ', even over the taste rules. Scene music still has to be plausible for the place.',
  ].filter(Boolean).join('\n');
  const строки = [];
  const добавить = (к, з) => { if (з) строки.push(к + ': ' + з); };
  добавить('Date', сцена.дата); добавить('Time', сцена.время); добавить('Weather', сцена.погода);
  добавить('Place', сцена.место); добавить('Mood', сцена.настроение); добавить('Atmosphere', сцена.атмосфера);
  if (сцена.бой) строки.push('Combat: yes, a fight or chase is going on');
  if (сцена.близость) строки.push('Intimacy: an intimate scene is in progress');
  добавить('Plot twist', обрезать(сцена.поворот, 200));
  const люди = (сцена.люди || []).map(ч => ч.имя + (ч.статус ? ' — ' + ч.статус : '') + (ч.близость && !НЕТ_БЛИЗОСТИ.test(ч.близость) ? ' (intimacy: ' + ч.близость + ')' : ''));
  if (люди.length) строки.push('Characters: ' + люди.join('; '));
  // Сообщения истории: выбранное число последних (старые первыми), иначе —
  // кусок последнего ответа, как раньше.
  const сообщения = контекст && Array.isArray(контекст.сообщения) ? контекст.сообщения : null;
  let история = '';
  if (сообщения && сообщения.length) {
    let всего = 0;
    const взято = [];
    for (let k = сообщения.length - 1; k >= 0; k--) {
      const с = сообщения[k];
      const строка = '[' + с.name + ']: ' + обрезать(с.text, ПРЕДЕЛ_СООБЩЕНИЯ);
      if (всего + строка.length > ПРЕДЕЛ_ИСТОРИИ && взято.length) break;
      всего += строка.length;
      взято.unshift(строка);
    }
    история = '\nRECENT STORY (oldest first):\n' + взято.join('\n\n');
  } else if (проза) история = '\nLAST STORY TEXT (excerpt):\n' + проза;
  // Справка — внутри <reference>; задание — после неё, последним, чтобы
  // модель закончила чтение на задании, а не на тексте истории.
  const user = ['<reference>', 'SCENE SNAPSHOT', ...строки,
    ...блокКонтекста(контекст).map(б => '\n' + б),
    история,
    нужно.has('phone') ? '\nPHONE OWNER: ' + телефон.владелец + (телефон.о ? ' (' + телефон.о + ')' : '') + (телефон.прежние.length ? '\nTheir phone library before: ' + телефон.прежние.slice(0, 8).join('; ') : '') : '',
    '</reference>',
    прежние.length ? '\nDo not repeat these recently used tracks: ' + прежние.slice(0, 16).join('; ') : '',
    просьба ? "\nPLAYER'S WISH (top priority, follow it): " + просьба : '',
    '\nTASK: choose music for this moment. Do not continue the story, do not write prose, dialogue or a reply to any character. Answer with ONLY the JSON object described in the instructions — start with "{" and end with "}".'].filter(Boolean).join('\n');
  return { system, user };
}

// Трек из ответа: объект {artist,title} или строка «Исполнитель - Название».
function трекИз(x) {
  if (!x) return null;
  if (typeof x === 'string') {
    const m = x.match(/^\s*(.+?)\s+[-–—]\s+(.+?)\s*$/);
    return m ? { a: обрезать(m[1], 80), t: обрезать(m[2], 100) } : null;
  }
  if (typeof x !== 'object') return null;
  const a = плоско(x.artist || x.a || x.performer || x.band || '');
  const t = плоско(x.title || x.t || x.track || x.song || x.name || '');
  if (!a || !t) return null;
  const why = плоско(x.why || x.reason || '');
  return { a: обрезать(a, 80), t: обрезать(t, 100), ...(why ? { why: обрезать(why, 80) } : {}) };
}
function безПовторов(список) {
  const видели = new Set();
  return список.filter(т => { const k = ключТрека(т); if (видели.has(k)) return false; видели.add(k); return true; });
}

/** Ответ модели → { label, soundtrack, scene }. Бросает, если JSON не найден. */
// Оборванный ответ (кончился лимит): берём целые треки до места обрыва —
// каждый трек отдельным объектом в своей части.
function спастиОборванный(текст) {
  const часть = (ключ, до) => {
    const i = текст.search(new RegExp('"' + ключ + '"\\s*:'));
    if (i < 0) return '';
    const концы = до.map(к => текст.slice(i + 1).search(new RegExp('"' + к + '"\\s*:'))).filter(x => x >= 0);
    return текст.slice(i, концы.length ? i + 1 + Math.min(...концы) : undefined);
  };
  const объекты = (кусок) => (кусок.match(/\{[^{}]*\}/g) || []).map(o => { try { return JSON.parse(o); } catch (_) { return null; } }).filter(Boolean);
  const метка = (текст.match(/"label"\s*:\s*"((?:[^"\\]|\\.)*)"/) || [])[1] || '';
  const саундтрек = объекты(часть('soundtrack', ['scene', 'phone']));
  const сцена = часть('scene', ['soundtrack', 'phone']);
  const вСцене = объекты(сцена).filter(o => o.artist || o.title);
  const источник = (сцена.match(/"source"\s*:\s*"((?:[^"\\]|\\.)*)"/) || [])[1] || '';
  const телефон = объекты(часть('phone', ['soundtrack', 'scene']));
  if (!саундтрек.length && !вСцене.length && !телефон.length) return null;
  return { label: метка, soundtrack: саундтрек, scene: вСцене.length ? { source: источник, tracks: вСцене } : null, phone: телефон.length ? { tracks: телефон } : null };
}

// JSON из ответа модели: без рассуждений и разметки; битый — без висячих
// запятых, оборванный — тем, что спасёт спасти.
function jsonОтвета(raw, спасти = () => null) {
  let t = raw;
  if (t && typeof t === 'object') t = t.content ?? t.text ?? t.choices?.[0]?.message?.content ?? '';
  if (Array.isArray(t)) t = t.map(c => (c && c.text) || '').join('');
  t = String(t || '').replace(/<(think|thinking|reasoning)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/```(?:json)?/gi, ' ');
  // Ответ оборвался на рассуждениях — JSON до конца не дошёл.
  if (/<(think|thinking|reasoning)\b/i.test(t) && !/<\/(think|thinking|reasoning)>/i.test(t)) throw new Error('ответ оборвался на рассуждениях модели — увеличьте лимит ответа в настройках музыки');
  const от = t.indexOf('{'), до = t.lastIndexOf('}');
  if (от < 0) throw new Error('модель не прислала подборку (нет JSON)');
  const кусок = до > от ? t.slice(от, до + 1) : t.slice(от);
  try { return JSON.parse(кусок); } catch (_) {
    try { return JSON.parse(кусок.replace(/,\s*([}\]])/g, '$1')); } catch (e) {
      const j = спасти(t.slice(от));
      if (!j) throw new Error('подборка пришла битой (' + e.message + ') — возможно, не хватило лимита ответа');
      return j;
    }
  }
}

// Теги станции и страна сцены (music-radio.js): короткие и без мусора.
const тегиРадио = (v) => (typeof v === 'string' && !/^(null|none|нет|-)?$/i.test(v.trim()) ? v.replace(/[^\p{L}\d\s,'/-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) : '');
const странаРадио = (v) => (typeof v === 'string' && /^[a-z]{2}$/i.test(v.trim()) ? v.trim().toUpperCase() : '');

export function разобратьОтвет(raw) {
  const j = jsonОтвета(raw, спастиОборванный);
  const саундтрек = безПовторов((Array.isArray(j.soundtrack) ? j.soundtrack : []).map(трекИз).filter(Boolean)).slice(0, 16);
  const сц = j.scene && typeof j.scene === 'object' ? j.scene : null;
  const вСцене = сц ? безПовторов((Array.isArray(сц.tracks) ? сц.tracks : []).map(трекИз).filter(Boolean)).slice(0, 4) : [];
  const тел = j.phone && typeof j.phone === 'object' ? j.phone : null;
  const вТелефоне = тел ? безПовторов((Array.isArray(тел.tracks) ? тел.tracks : Array.isArray(тел) ? тел : []).map(трекИз).filter(Boolean)).slice(0, 10) : [];
  if (!саундтрек.length && !вСцене.length && !вТелефоне.length) throw new Error('модель прислала пустую подборку');
  const радио = сц ? тегиРадио(сц.radio) : '';
  return {
    label: обрезать(плоско(j.label || ''), 48),
    soundtrack: саундтрек,
    scene: вСцене.length || радио ? { src: обрезать(плоско(сц.source || сц.src || ''), 48), tracks: вСцене, ...(радио ? { radio: радио } : {}), ...(странаРадио(сц.country) ? { country: странаРадио(сц.country) } : {}) } : null,
    phone: вТелефоне.length ? { tracks: вТелефоне } : null,
  };
}

/** Ответ модели на плейлист телефона → { name, tracks }. */
export function разобратьПлейлист(raw) {
  const j = jsonОтвета(raw, (кусок) => {
    const треки = (кусок.match(/\{[^{}]*\}/g) || []).map(o => { try { return JSON.parse(o); } catch (_) { return null; } }).filter(o => o && (o.artist || o.title));
    return треки.length ? { name: (кусок.match(/"name"\s*:\s*"((?:[^"\\]|\\.)*)"/) || [])[1] || '', tracks: треки } : null;
  });
  const треки = безПовторов((Array.isArray(j.tracks) ? j.tracks : Array.isArray(j.playlist) ? j.playlist : []).map(трекИз).filter(Boolean)).slice(0, 20);
  if (!треки.length) throw new Error('модель прислала пустой плейлист');
  return { name: обрезать(плоско(j.name || j.title || ''), 48), tracks: треки.map(({ why, ...т }) => т) };
}

// ---------------------------------------------------------------------------
// ПРОВЕРКА ТРЕКОВ (iTunes Search API: открыт для браузера, без ключа)
// ---------------------------------------------------------------------------

// Сравнение треков (норм, нормНазв, ключТрека) — в music-lib.js: им пользуются
// и вкус, и библиотека телефона.

/** Совпадение трека с выдачей поиска: тот же исполнитель и то же название. */
export function совпадение(трек, выдача) {
  const na = норм(трек.a), nt = нормНазв(трек.t);
  if (!na || !nt) return null;
  const словаА = new Set(na.split(' ').filter(w => w.length > 2));
  for (const r of Array.isArray(выдача) ? выдача : []) {
    const ra = норм(r && r.artistName), rt = нормНазв(r && r.trackName);
    if (!ra || !rt) continue;
    const исполнитель = ra.includes(na) || na.includes(ra) || ra.split(' ').some(w => w.length > 2 && словаА.has(w));
    const название = rt === nt || rt.startsWith(nt + ' ') || nt.startsWith(rt + ' ');
    if (исполнитель && название) {
      return {
        a: String(r.artistName), t: String(r.trackName),
        art: String(r.artworkUrl100 || '').replace(/\/\d+x\d+bb\./, '/200x200bb.'),
        url: String(r.trackViewUrl || ''),
        // 30-секундный отрывок — его играет встроенный плеер.
        pv: /^https:\/\/[\w.-]+\.apple\.com\//.test(String(r.previewUrl || '')) ? String(r.previewUrl) : '',
      };
    }
  }
  return null;
}

// Где искать: сначала каталог iTunes (официальный, витрины США и России),
// потом, если включено, NetEase Cloud Music и QQ Музыка — через неофициальные
// посредники (те же, что в регексах-плеерах). Нашли — дальше не ищем. Русские
// и азиатские треки у Apple бывают не видны, у NetEase и QQ они есть.
const ПОИСК_NETEASE = 'https://music-api.gdstudio.xyz/api.php';
const ПОИСК_QQ = 'https://api.vkeys.cn/v2/music/tencent';
const кэшПоиска = new Map();
const жди = (мс, внешний) => {
  const c = new AbortController();
  const т = setTimeout(() => c.abort(), мс);
  if (внешний) внешний.addEventListener('abort', () => c.abort(), { once: true });
  c.signal.addEventListener('abort', () => clearTimeout(т), { once: true });
  return c.signal;
};
const получить = (url, signal) => fetch(url, { signal: жди(8000, signal), credentials: 'omit', referrerPolicy: 'no-referrer' })
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
const списокИмён = (x) => (Array.isArray(x) ? x : [x]).map(v => typeof v === 'string' ? v : v && v.name).filter(Boolean).join(', ');

async function вiTunes(трек, signal, страна) {
  const p = new URLSearchParams({ term: трек.a + ' ' + трек.t, entity: 'song', media: 'music', limit: '10' });
  if (страна) p.set('country', страна);
  const j = await получить('https://itunes.apple.com/search?' + p, signal);
  const н = совпадение(трек, j && j.results);
  return н ? { ...н, src: 'apple' } : null;
}
async function вNetEase(трек, signal) {
  const j = await получить(ПОИСК_NETEASE + '?' + new URLSearchParams({ types: 'search', count: '8', source: 'netease', name: трек.a + ' ' + трек.t }), signal);
  const x = (Array.isArray(j) ? j : []).find(x => x && x.id && совпадение(трек, [{ artistName: списокИмён(x.artist), trackName: x.name }]));
  if (!x) return null;
  let art = '';
  if (x.pic_id) {
    try {
      const pic = await получить(ПОИСК_NETEASE + '?' + new URLSearchParams({ types: 'pic', id: String(x.pic_id), source: 'netease', size: '300' }), signal);
      if (pic && /^https:\/\/[\w.-]+\.126\.net\//.test(String(pic.url || ''))) art = String(pic.url);
    } catch (_) { /* без обложки */ }
  }
  return { art, url: 'https://music.163.com/song?id=' + encodeURIComponent(x.id), ne: String(x.id), src: 'netease' };
}
async function вQQ(трек, signal) {
  const j = await получить(ПОИСК_QQ + '?' + new URLSearchParams({ word: трек.a + ' ' + трек.t }), signal);
  const x = (Array.isArray(j && j.data) ? j.data : []).find(x => x && совпадение(трек, [{ artistName: x.singer || списокИмён(x.singer_list), trackName: x.song }]));
  if (!x) return null;
  const art = /^https:\/\/[\w.-]+\.qq\.com\//.test(String(x.cover || '')) ? String(x.cover).replace(/R800x800/, 'R300x300') : '';
  return { art, url: x.mid ? 'https://y.qq.com/n/ryqq/songDetail/' + encodeURIComponent(x.mid) : '', src: 'qq' };
}

/** Шаги поиска по порядку — iTunes всегда, NetEase и QQ по настройкам. */
export function шагиПоиска(трек) {
  const кириллица = /[а-яё]/i.test(трек.a + трек.t);
  return [
    ['iTunes', (т, сиг) => вiTunes(т, сиг, кириллица ? 'ru' : '')],
    ['iTunes', (т, сиг) => вiTunes(т, сиг, кириллица ? '' : 'ru')],
    settings.musicSearchNetease !== false && ['NetEase', вNetEase],
    settings.musicSearchQQ !== false && ['QQ', вQQ],
  ].filter(Boolean);
}

// Ищем по очереди; нашли — стоп. Все сервисы недоступны — ошибка (трек не
// «выдуман», просто проверить не удалось).
async function искатьТрек(трек, signal) {
  const ключ = ключТрека(трек);
  if (кэшПоиска.has(ключ)) return кэшПоиска.get(ключ);
  let ответили = 0, ошибка = null;
  for (const [, шаг] of шагиПоиска(трек)) {
    try {
      const н = await шаг(трек, signal);
      ответили++;
      if (н) { кэшПоиска.set(ключ, н); return н; }
    } catch (e) {
      if (signal && signal.aborted) throw e;
      ошибка = e;
    }
  }
  if (!ответили && ошибка) throw ошибка;
  кэшПоиска.set(ключ, null);
  return null;
}
// Плеер ищет отрывок — он есть только у iTunes.
const искатьВiTunes = async (трек, signal) => {
  const н = await искатьТрек(трек, signal);
  if (н && н.src === 'apple') return н;
  const кириллица = /[а-яё]/i.test(трек.a + трек.t);
  for (const страна of кириллица ? ['ru', ''] : ['', 'ru']) {
    try { const и = await вiTunes(трек, signal, страна); if (и) return и; } catch (_) { /* дальше */ }
  }
  return null;
};

/** Сверить список: ok true — найден, false — не найден, null — проверить не удалось. */
async function сверить(список, signal) {
  const итог = список.map(т => ({ ...т }));
  let i = 0;
  const работник = async () => {
    while (i < итог.length) {
      const т = итог[i++];
      try {
        const н = await искатьТрек(т, signal);
        // Имена оставляем модельные: каталог пишет «Max Richter, Louisa
        // Fuller, … & Chris Worsey» и «saman» строчными. Берём обложку и ссылку.
        if (н) Object.assign(т, { ok: true, src: н.src }, н.art ? { art: н.art } : {}, н.url ? { url: н.url } : {}, н.pv ? { pv: н.pv } : {}, н.ne ? { ne: н.ne } : {});
        else т.ok = false;
      } catch (e) {
        if (signal && signal.aborted) throw e;
        т.ok = null;
      }
    }
  };
  await Promise.all([работник(), работник(), работник()]);
  return итог;
}

// Ненайденные уходят, если найденных хватает; иначе остаются с пометкой.
export function отобрать(список, нужно) {
  const годные = список.filter(т => т.ok !== false);
  const мимо = список.filter(т => т.ok === false);
  return годные.length >= Math.min(нужно, 4) ? годные.slice(0, нужно) : [...годные, ...мимо].slice(0, нужно);
}

// ---------------------------------------------------------------------------
// ХРАНЕНИЕ: подборка хода в message.extra (у каждого свайпа своя)
// ---------------------------------------------------------------------------

const текстХода = (m) => { const s = m && Array.isArray(m.swipes) ? m.swipes[m.swipe_id] : undefined; return typeof s === 'string' ? s : String((m && m.mes) || ''); };

function сохранитьЧат(ctx) {
  try {
    const f = typeof ctx.saveChatConditional === 'function' ? ctx.saveChatConditional : typeof ctx.saveChat === 'function' ? ctx.saveChat : null;
    if (f) Promise.resolve(f.call(ctx)).catch(e => console.warn('[TavernOS HUD] музыка: чат не сохранился', e));
  } catch (e) { console.warn('[TavernOS HUD] музыка: чат не сохранился', e); }
}

// Последний настоящий блок хода (упоминания в <plan> не в счёт), без меток.
function данныеHUD(message) {
  const блоки = hudБлоки(текстХода(message));
  for (let i = блоки.length - 1; i >= 0; i--) {
    try { return parseHUDComplex(блоки[i].inner); } catch (_) { /* битый — ищем выше */ }
  }
  return null;
}

// Ближайшая прежняя подборка выше хода (за 60 сообщений).
function прежняяМузыка(chat, индекс) {
  for (let i = индекс - 1; i >= 0 && i >= индекс - 60; i--) {
    const м = музыкаХода(chat[i]);
    if (м) return { м, i };
  }
  return null;
}

function проза(message, предел = 1200) {
  const t = заменитьHudБлоки(текстХода(message), ' ')
    .replace(/<(think|thinking|plan|reasoning|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > предел ? '…' + t.slice(-предел) : t;
}

// Что ещё видит модель, кроме сцены: сообщения, карточка, персона, лорбуки —
// по настройкам «Музыки сцены». Помощники — те же, что у «Спросить про сюжет».
async function собратьКонтекстМузыки(ctx, chat, индекс) {
  const сколько = Math.max(0, Math.min(30, parseInt(settings.musicContextMessages ?? 1, 10) || 0));
  const сообщения = [];
  for (let k = индекс; k >= 0 && сообщения.length < сколько; k--) {
    const m = chat[k];
    if (!m || m.is_system) continue;
    const текст = проза(m, ПРЕДЕЛ_СООБЩЕНИЯ);
    if (текст) сообщения.unshift({ name: String(m.name || (m.is_user ? 'User' : '?')), text: текст });
  }
  const нуженПомощник = settings.musicIncludeCard === true || settings.musicIncludePersona === true;
  let карточка = null, персона = '';
  if (нуженПомощник) {
    try {
      const A = await import('./assistant.js?v=23.88.4');
      if (settings.musicIncludeCard === true) карточка = A.карточкаПерсонажа(ctx);
      if (settings.musicIncludePersona === true) персона = A.персонаИгрока(ctx);
    } catch (e) { console.warn('[TavernOS HUD] музыка: карточка и персона', e); }
  }
  let лор = [];
  const книги = Array.isArray(settings.musicLorebooks) ? settings.musicLorebooks.filter(Boolean) : [];
  if (книги.length && основа && typeof основа.лорбуки === 'function') {
    try { лор = await основа.лорбуки(книги, сообщения.map(с => с.text).join('\n'), settings.musicLoreAll === true); }
    catch (e) { console.warn('[TavernOS HUD] музыка: лорбуки', e); }
  }
  return { сообщения: сколько ? сообщения : [], карточка, персона, лор };
}

const ключХода = (ctx, индекс, message) => String(ctx && typeof ctx.getCurrentChatId === 'function' ? ctx.getCurrentChatId() : '') + ':' + индекс + ':' + номерСвайпа(message);

// ---------------------------------------------------------------------------
// ПОДБОРКА
// ---------------------------------------------------------------------------

// Лимит ответа: думающая модель тратит его и на рассуждения, и при малом
// лимите JSON обрывается. Настройка — не меньше 2048, по умолчанию 8192.
export const лимитОтвета = () => Math.max(2048, Math.min(65536, parseInt(settings.musicMaxTokens, 10) || 8192));

async function отправить(ctx, system, user, signal) {
  const профиль = String(settings.musicProfileId || '');
  const служба = ctx.ConnectionManagerRequestService;
  if (профиль && служба && typeof служба.sendRequest === 'function') {
    return служба.sendRequest(профиль, [{ role: 'system', content: system }, { role: 'user', content: user }], лимитОтвета(),
      { stream: false, signal, extractData: true, includePreset: false, includeInstruct: false });
  }
  return генерацияТаверны(ctx, { prompt: user, systemPrompt: system, responseLength: лимитОтвета() });
}

/**
 * Подобрать музыку к ходу. авто — по смене сцены (та же сцена → копия
 * прежней подборки без запроса); вручную — всегда новый запрос.
 */
/**
 * Подобрать музыку к ходу. авто — по смене сцены (та же сцена → копия
 * прежней подборки без запроса); вручную — всегда новый запрос. части —
 * подобрать только их (кнопки «Саундтрек», «В сцене», «Телефон»): остальное
 * у хода остаётся как было.
 */
// Запрос к модели с таймером и отменой. Флаг __tavernOSHudSkipInject — чтобы
// перехват HUD (index.js) не дописал в запрос свою инструкцию.
async function спросить(ctx, system, user, отмена) {
  // Сколько ждать ответа: настройка в секундах, 0 — без таймера.
  const ждать = Math.max(0, Math.min(3600, parseInt(settings.musicTimeout ?? 120, 10) || 0)) * 1000;
  window.__tavernOSHudSkipInject = (window.__tavernOSHudSkipInject || 0) + 1;
  let таймер = 0;
  try {
    return await Promise.race([
      отправить(ctx, system, user, отмена.signal),
      ...(ждать ? [new Promise((_, reject) => { таймер = setTimeout(() => reject(new Error('модель молчит дольше ' + ждать / 1000 + ' с')), ждать); })] : []),
      new Promise((_, reject) => отмена.signal.addEventListener('abort', () => reject(new Error('отменено')), { once: true })),
    ]);
  } finally {
    // Ответ пришёл — таймер ожидания больше не нужен.
    clearTimeout(таймер);
    window.__tavernOSHudSkipInject = Math.max(0, (window.__tavernOSHudSkipInject || 1) - 1);
  }
}

// «Нравится» и «не предлагать» игрока — в настройках (общие для телефона и ПК).
const лайкиИгрока = () => (Array.isArray(settings.musicLiked) ? settings.musicLiked : []);
const запретыИгрока = () => (Array.isArray(settings.musicBanned) ? settings.musicBanned : []);
// Библиотека телефона — в метаданных открытого чата.
const библиотекаЧата = (создать = false) => { const ctx = контекст(); return ctx ? библиотека(ctx.chatMetadata, создать) : null; };
const лайкиТелефона = (владелец) => { const з = записьВладельца(библиотекаЧата(), владелец); return з ? з.liked : []; };

/**
 * мемы — мемный саундтрек этой подборки: true/false — по кнопке, null — по
 * настройке («по тону сцены» решает смешнаяСцена).
 */
export async function подобратьМузыку(индекс, { вручную = false, части = null, мемы: мемыКнопкой = null } = {}) {
  const ctx = контекст();
  const chat = ctx && Array.isArray(ctx.chat) ? ctx.chat : null;
  const message = chat && chat[индекс];
  if (!message || message.is_user) return;
  const ключ = ключХода(ctx, индекс, message);
  if (идут.has(ключ)) return;
  const data = данныеHUD(message);
  if (!data) { показать('info', 'Музыка', 'В этом сообщении нет HUD — сцену взять неоткуда.'); return; }

  const сцена = сценаИзHUD(data);
  const прежняя = прежняяМузыка(chat, индекс);
  const причина = чемОтличается(прежняя && прежняя.м.сцена, сцена);
  if (!вручную && прежняя && !причина) {
    // Сцена та же — играет та же подборка. Сцену оставляем прежнюю: сравнивать
    // надо с той, под которую музыку подбирали, иначе мелкие сдвиги копятся.
    сохранитьМузыку(message, { ...прежняя.м, swipe: номерСвайпа(message), from: прежняя.м.from ?? прежняя.i, at: Date.now() });
    сохранитьЧат(ctx);
    вЛетопись(message, индекс);
    обновитьПолосу(индекс); обновитьСтрокуСцены();
    return;
  }

  // Телефон — только в современности и при включённом приложении «Музыка».
  const владелец = сцена.эра === 'modern' && settings.enablePhone !== false && settings.phoneAppMusic !== false ? владелецТелефона(data) : '';
  const нужно = (Array.isArray(части) && части.length ? части : ЧАСТИ_МУЗЫКИ).filter(ч => ЧАСТИ_МУЗЫКИ.includes(ч) && (ч !== 'phone' || владелец));
  if (!нужно.length) return;
  const частично = нужно.length < (владелец ? 3 : 2);
  const былоУХода = музыкаХода(message);

  const отмена = new AbortController();
  идут.set(ключ, { отмена, части: нужно });
  ошибки.delete(ключ);
  обновитьПолосу(индекс);
  try {
    const сколько = Math.max(4, Math.min(12, parseInt(settings.musicCount, 10) || 8));
    const источник = былоУХода || (прежняя && прежняя.м) || null;
    const прежние = источник ? [...(нужно.includes('soundtrack') ? источник.soundtrack || [] : []), ...(нужно.includes('scene') ? (источник.scene && источник.scene.tracks) || [] : [])].map(т => т.a + ' — ' + т.t) : [];
    const телефонРанее = [былоУХода, прежняя && прежняя.м].map(м => м && м.phone).find(т => т && т.owner === владелец) || null;
    // У телефона свой вкус — его «Нравится» из приложения «Музыка».
    const телефон = владелец ? { владелец, о: оВладельце(data, владелец), прежние: телефонРанее ? телефонРанее.tracks.map(т => т.a + ' — ' + т.t) : [], вкус: строкиВкуса({ лайки: лайкиТелефона(владелец), чьи: владелец }) } : null;
    // Не «контекст»: это имя функции, ниже она нужна — проверить, что чат тот же.
    const справка = await собратьКонтекстМузыки(ctx, chat, индекс);
    const мемы = нужно.includes('soundtrack') && (мемыКнопкой ?? мемныйРежим(settings.musicMeme, сцена));
    const радио = нужно.includes('scene') && сцена.эра === 'modern' && settings.musicRadio !== false;
    const { system, user } = промптМузыки({ сцена, проза: проза(message), прежние: вручную || причина ? прежние : [], сколько, телефон, части: нужно, контекст: справка,
      вкус: строкиВкуса({ лайки: лайкиИгрока(), запреты: запретыИгрока() }), языкПесни: языкПесен(settings), мемы, радио });
    const raw = await спросить(ctx, system, user, отмена);
    const ответ = разобратьОтвет(raw);
    // То, что игрок просил не предлагать, — прочь, даже если модель прислала.
    let саундтрек = нужно.includes('soundtrack') ? безЗапрещённых(ответ.soundtrack, запретыИгрока()) : [];
    let вСцене = нужно.includes('scene') && ответ.scene ? безЗапрещённых(ответ.scene.tracks, запретыИгрока()) : [];
    let вТелефоне = нужно.includes('phone') && ответ.phone ? безЗапрещённых(ответ.phone.tracks, запретыИгрока()) : [];
    const радиоТеги = нужно.includes('scene') && ответ.scene ? ответ.scene.radio || '' : '';
    if (частично && !саундтрек.length && !вСцене.length && !вТелефоне.length && !радиоТеги) {
      throw new Error(нужно.includes('scene') ? 'модель не нашла, что могло бы звучать в сцене' : 'модель не прислала треков');
    }
    if (settings.musicVerify !== false) {
      // Подряд, а не разом: у iTunes предел запросов в минуту. Мемных звуков
      // в каталогах нет — их не сверяем, иначе отбросились бы все.
      if (!мемы) саундтрек = await сверить(саундтрек, отмена.signal);
      вСцене = await сверить(вСцене, отмена.signal);
      вТелефоне = await сверить(вТелефоне, отмена.signal);
    }
    const выдуманные = [...саундтрек, ...вСцене, ...вТелефоне].filter(т => т.ok === false);
    саундтрек = отобрать(саундтрек, сколько);
    вСцене = отобрать(вСцене, 3);
    вТелефоне = отобрать(вТелефоне, 6);
    const осталось = new Set([...саундтрек, ...вСцене, ...вТелефоне]);
    // Пока ждали, чат могли сменить или сообщение удалить.
    const сейчас = контекст();
    if (!сейчас || ключХода(сейчас, индекс, сейчас.chat && сейчас.chat[индекс]) !== ключ) return;
    // Часть подбиралась отдельно — остальное у хода остаётся как было. Копией
    // прежнего хода ход после этого уже не считается.
    const основа_ = частично && былоУХода ? { ...былоУХода } : {};
    delete основа_.from;
    const новая = {
      ...основа_, v: 1, swipe: номерСвайпа(message), at: Date.now(),
      сцена: основа_.сцена || сцена,
      why: частично ? (основа_.why || 'по кнопке') : вручную ? 'по кнопке' : причина,
      label: (частично && основа_.label) || ответ.label || основа_.label || '',
      dropped: выдуманные.filter(т => !осталось.has(т)).length,
    };
    if (нужно.includes('soundtrack')) {
      новая.soundtrack = саундтрек; новая.now = ['s', 0];
      if (мемы) новая.meme = true; else delete новая.meme;
    } else if (!Array.isArray(новая.soundtrack)) новая.soundtrack = [];
    if (нужно.includes('scene')) {
      новая.scene = вСцене.length || радиоТеги ? { src: ответ.scene.src, tracks: вСцене, ...(радиоТеги ? { radio: радиоТеги } : {}), ...(ответ.scene.country ? { country: ответ.scene.country } : {}) } : null;
      радиоХода.delete(Number(индекс));
      if (!нужно.includes('soundtrack') && вСцене.length) новая.now = ['c', 0];
    } else if (новая.scene === undefined) новая.scene = null;
    // Модель забыла про телефон — у владельца остаётся прежняя музыка.
    if (нужно.includes('phone')) новая.phone = вТелефоне.length ? { owner: владелец, tracks: вТелефоне } : телефонРанее;
    else if (новая.phone === undefined) новая.phone = телефонРанее;
    сохранитьМузыку(message, новая);
    сохранитьЧат(ctx);
    вЛетопись(message, индекс);
    обновитьСтрокуСцены();
  } catch (e) {
    if (!отмена.signal.aborted) {
      console.warn('[TavernOS HUD] музыка не подобралась:', e);
      ошибки.set(ключ, e && e.message ? e.message : String(e));
    }
  } finally {
    идут.delete(ключ);
    обновитьПолосу(индекс);
  }
}

// Летопись (chronicle-store.js) пополняется сама после ответа, но подборка
// приходит позже — дописываем ход ещё раз, уже с музыкой.
function вЛетопись(message, индекс) {
  try {
    const выжимка = выжимкаСообщения(message);
    if (выжимка) дописатьВЛетопись(new Map([[ключСообщения(message, индекс), выжимка]])).catch(() => {});
  } catch (_) { /* летопись — не повод терять подборку */ }
}

function отменить(индекс) {
  const ctx = контекст();
  const message = ctx && ctx.chat && ctx.chat[индекс];
  const занято = message && идут.get(ключХода(ctx, индекс, message));
  if (занято) занято.отмена.abort();
}

// ---------------------------------------------------------------------------
// ПОЛОСА В КАРТОЧКЕ
// ---------------------------------------------------------------------------

const ВИНИЛ = 'noir mafia academia cottage vamp witch egypt voodoo western dieselpunk steampunk pirate fantasy japan'.split(' ');
export function видПолосы() {
  const v = settings.musicStyle;
  if (v === 'cassette' || v === 'vinyl' || v === 'scroll') return v;
  if (settings.era === 'medieval' || settings.themePreset === 'medieval') return 'scroll';
  return ВИНИЛ.includes(settings.themePreset) ? 'vinyl' : 'cassette';
}

const ИКО = {
  note: 'M9.5 18V5l11-2v13 M9.5 18a3 3 0 1 1-6 0a3 3 0 1 1 6 0 M20.5 16a3 3 0 1 1-6 0a3 3 0 1 1 6 0',
  minus: 'M6 12h12',
  close: 'M7 7l10 10 M17 7 7 17',
  plus: 'M12 6v12 M6 12h12',
  chev: 'm6 9 6 6 6-6',
  redo: 'M3 12a9 9 0 0 1 15.5-6.3L21 8 M21 3v5h-5 M21 12a9 9 0 0 1-15.5 6.3L3 16 M3 21v-5h5',
  queue: 'M3 6h12 M3 12h12 M3 18h8 M17 15v6 M14 18h6',
  speaker: 'M4 9h4l5-4v14l-5-4H4Z M17 9a4 4 0 0 1 0 6 M19.5 6.5a8 8 0 0 1 0 11',
  search: 'M11 4a7 7 0 1 1 0 14a7 7 0 1 1 0-14 M20 20l-4-4',
  stop: 'M6 6h12v12H6Z',
  warn: 'M12 3 2 20h20Z M12 10v4 M12 17h.01',
  heart: 'M12 20s-7-4.4-9.2-8.7A5 5 0 0 1 12 6.2a5 5 0 0 1 9.2 5.1C19 15.6 12 20 12 20Z',
  ban: 'M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 1 1 0-17 M6 6l12 12',
  radio: 'M3.5 9.5h17v10h-17Z M7 9.5l10-5 M8.5 13a1.8 1.8 0 1 1 0 3.6a1.8 1.8 0 1 1 0-3.6 M13.5 13.2h4 M13.5 16.2h4',
  meme: 'M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 1 1 0-17 M8 14s1.5 2.3 4 2.3 4-2.3 4-2.3 M9 9.8h.01 M15 9.8h.01',
  back: 'm15 5-7 7 7 7',
  trash: 'M4 7h16 M9.5 7V4.5h5V7 M6.5 7l1 12.5h9l1-12.5',
  list: 'M9 6h11 M9 12h11 M9 18h11 M4.5 6h.01 M4.5 12h.01 M4.5 18h.01',
  up: 'M12 19V6 M6 11l6-6 6 6',
  waves: 'M3 9.5c2-2.2 4-2.2 6 0s4 2.2 6 0 4-2.2 6 0 M3 15c2-2.2 4-2.2 6 0s4 2.2 6 0 4-2.2 6 0',
  skip: 'M5 5.5 15 12 5 18.5Z M19 5.5v13',
};
const ИГРА = '<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5.6 5.2v13.6c0 .8.9 1.3 1.6.9l10.6-6.8a1.05 1.05 0 0 0 0-1.8L7.2 4.3C6.5 3.9 5.6 4.4 5.6 5.2Z"/></svg>'
  + '<svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.5 4.5h3.6v15H6.5zM13.9 4.5h3.6v15h-3.6z"/></svg>'
  + '<i class="i-load" aria-hidden="true"></i>';
const плеерВключён = () => settings.musicPlayer !== false;
const кнопкаИгры = (группа, i, т, класс = 'hud-music-act hud-music-play') => !плеерВключён() || !т ? ''
  : `<button type="button" class="${класс}${игра.mesid !== null && игра.g === группа && игра.i === i ? ' is-on' : ''}" data-mu="play" data-g="${группа}" data-i="${i}" title="${полныйИсточник() || группа === 'f' || группа === 'r' ? 'Слушать' : 'Слушать отрывок (30 с)'}" aria-label="Слушать: ${escapeHtml(т.a + ' — ' + т.t)}">${ИГРА}</button>`;
const ико = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ИКО[k]}"/></svg>`;

// Обложка в полосе — по виду: пластинка с обложкой в «яблоке», кассета с
// окошком катушек, свиток с нотами. Крутится только под мышью и по касанию.
function обложка(вид, art) {
  const картинка = art ? `<img src="${escapeHtml(art)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '';
  if (вид === 'vinyl') return `<span class="hud-music-disc" aria-hidden="true"><span class="hud-music-label-art">${картинка}</span></span>`;
  if (вид === 'scroll') return `<span class="hud-music-scroll" aria-hidden="true"><svg viewBox="0 0 40 30"><path class="sc-paper" d="M7 5h26v20H7z"/><path class="sc-roll" d="M4 4h6v22H4zM30 4h6v22h-6z"/><path class="sc-staff" d="M11 10h18M11 13h18M11 16h18M11 19h18"/><path class="sc-notes" d="M15 18.5a1.4 1.1 0 1 1-.1 0zM15 18.5V11M22 15.5a1.4 1.1 0 1 1-.1 0zM22 15.5V9.5M15 11l7-1.5"/></svg></span>`;
  return `<span class="hud-music-tape" aria-hidden="true"><span class="hud-music-tape-art">${картинка}</span><i class="r1"></i><i class="r2"></i></span>`;
}

const ИМЕНА_СЕРВИСОВ = { ya: 'Яндекс', sp: 'Spotify', yt: 'YouTube', sc: 'SoundCloud', ap: 'Apple', ne: 'NetEase', qq: 'QQ' };
const ссылка = (url, имя, подпись) => `<a class="hud-music-svc is-${имя}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(подпись)}">${escapeHtml(ИМЕНА_СЕРВИСОВ[имя])}</a>`;
export function ссылкиТрека(т) {
  const q = encodeURIComponent(т.a + ' ' + т.t);
  return [
    ссылка('https://music.yandex.ru/search?text=' + q, 'ya', 'Найти в Яндекс Музыке'),
    ссылка('https://open.spotify.com/search/' + q, 'sp', 'Найти в Spotify'),
    ссылка('https://www.youtube.com/results?search_query=' + q, 'yt', 'Найти на YouTube'),
    ссылка('https://soundcloud.com/search/sounds?q=' + q, 'sc', 'Найти на SoundCloud'),
    т.url && /^https:\/\/music\.apple\.com\//.test(т.url) ? ссылка(т.url, 'ap', 'Открыть в Apple Music') : '',
    т.url && /^https:\/\/music\.163\.com\//.test(т.url) ? ссылка(т.url, 'ne', 'Открыть в NetEase Cloud Music') : '',
    т.url && /^https:\/\/y\.qq\.com\//.test(т.url) ? ссылка(т.url, 'qq', 'Открыть в QQ Музыке') : '',
  ].join('');
}

// «Нравится» и «не предлагать» у трека. В полосе сцены — ваш вкус
// (settings), в телефоне «нравится» — вкус владельца (data-mu="plike").
const кнопкаЛайка = (т, группа, i, есть, действие = 'like') => `<button type="button" class="hud-music-like${есть ? ' is-on' : ''}" data-mu="${действие}" data-g="${группа}" data-i="${i}" aria-pressed="${есть}" title="${есть ? 'Убрать из «Нравится»' : действие === 'plike' ? 'Нравится — так и звучит этот человек: его следующие плейлисты будут ближе к такому' : 'Нравится — следующие подборки будут ближе к такому'}" aria-label="Нравится: ${escapeHtml(т.a + ' — ' + т.t)}">${ико('heart')}</button>`;
const кнопкаЗапрета = (т, группа, i, есть) => `<button type="button" class="hud-music-ban${есть ? ' is-on' : ''}" data-mu="ban" data-g="${группа}" data-i="${i}" aria-pressed="${есть}" title="${есть ? 'Снова можно предлагать' : 'Не предлагать больше — ни в сцене, ни в телефоне'}" aria-label="Не предлагать: ${escapeHtml(т.a + ' — ' + т.t)}">${ико('ban')}</button>`;

function строкаТрека(т, i, группа, сейчас) {
  const пометка = т.ok === false ? '<span class="hud-music-flag" title="Поиск такого трека не нашёл — возможно, модель его выдумала">не найден</span>' : '';
  const мини = т.art ? `<span class="hud-music-art"><img src="${escapeHtml(т.art)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>` : `<span class="hud-music-art is-blank">${ико('note')}</span>`;
  const лайк = вСписке(лайкиИгрока(), т), запрет = вСписке(запретыИгрока(), т);
  return `<li class="hud-music-tr${т.ok === false ? ' is-unfound' : ''}${сейчас ? ' is-now' : ''}${лайк ? ' is-liked' : ''}${запрет ? ' is-banned' : ''}">`
    + `<span class="hud-music-n" aria-hidden="true">${i + 1}</span>${плеерВключён() ? `<span class="hud-music-art-wrap">${мини}${запрет ? '' : кнопкаИгры(группа, i, т, 'hud-music-artplay')}</span>` : мини}`
    + `<span class="hud-music-tt" role="button" tabindex="0" data-mu="now" data-g="${группа}" data-i="${i}" title="Поставить в «сейчас играет»"><b>${escapeHtml(т.t)}</b><em>${escapeHtml(т.a)}</em>${т.why ? `<small>${escapeHtml(т.why)}</small>` : ''}${пометка}</span>`
    + `<span class="hud-music-go"><span class="hud-music-taste">${кнопкаЛайка(т, группа, i, лайк)}${кнопкаЗапрета(т, группа, i, запрет)}</span>${ссылкиТрека(т)}<button type="button" class="hud-music-mt" data-mu="queue" data-g="${группа}" data-i="${i}" title="Отдать в очередь MoodTube">${ико('queue')}<span>MoodTube</span></button></span>`
    + `</li>`;
}

const сЧислом = (n, о) => n + ' ' + (n % 10 === 1 && n % 100 !== 11 ? о[0] : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? о[1] : о[2]);

/** Полоса музыки для карточки хода; '' — показывать нечего. */
const ИМЕНА_ЧАСТЕЙ = { soundtrack: 'саундтрек', scene: 'в сцене', phone: 'телефон' };

// Громкость и число треков — прямо в плейлисте, одной тонкой строкой:
// крутить их удобнее здесь, чем в настройках расширения.
const громкость = () => Math.max(0, Math.min(100, Number(settings.musicVolume ?? 70)));
const числоТреков = () => Math.max(4, Math.min(12, parseInt(settings.musicCount, 10) || 8));
function строкаНастроек() {
  return `<div class="hud-music-tune">`
    + (плеерВключён() ? `<label class="hud-music-vol" title="Громкость"><span class="hud-music-vol-ico">${ико('speaker')}</span><input type="range" min="0" max="100" step="5" value="${громкость()}" data-mu-set="volume" aria-label="Громкость"><output>${громкость()}</output></label>` : '')
    + `<label class="hud-music-wish" title="Пожелание к следующей подборке: что вы хотите услышать. Модель следует ему в первую очередь. Хранится, пока не сотрёте."><span class="hud-music-wish-ico">${ико('note')}</span><input type="text" maxlength="300" data-mu-set="wish" value="${escapeHtml(settings.musicWish || '')}" placeholder="Пожелание: например, музыка для бега" aria-label="Пожелание к музыке"><button type="button" data-mu="wish-clear" title="Стереть пожелание" aria-label="Стереть пожелание"${settings.musicWish ? '' : ' hidden'}>${ико('close')}</button></label>`
    + `<span class="hud-music-cnt" title="Сколько треков в саундтреке — для следующей подборки"><button type="button" data-mu="count" data-d="-1" aria-label="Меньше треков"${числоТреков() <= 4 ? ' disabled' : ''}>${ико('minus')}</button><b>${числоТреков()}</b><button type="button" data-mu="count" data-d="1" aria-label="Больше треков"${числоТреков() >= 12 ? ' disabled' : ''}>${ико('plus')}</button><small>треков</small></span>`
    + `</div>`;
}

// Применить громкость сразу и показать её на всех полосах.
function поставитьГромкость(v, сохранить) {
  settings.musicVolume = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
  if (игра.audio) игра.audio.volume = settings.musicVolume / 100;
  document.querySelectorAll('.hud-music input[data-mu-set="volume"]').forEach(п => { if (Number(п.value) !== settings.musicVolume) п.value = settings.musicVolume; const o = п.parentElement.querySelector('output'); if (o) o.textContent = settings.musicVolume; });
  if (сохранить && основа && typeof основа.saveSettings === 'function') основа.saveSettings();
}
// Пожелание: печатаем — в памяти сразу (перерисовка полосы его не потеряет),
// ушли из поля — сохраняем. Во всех полосах одно и то же.
function поставитьПожелание(текст, сохранить, откуда = null) {
  settings.musicWish = String(текст || '').slice(0, 300);
  document.querySelectorAll('.hud-music input[data-mu-set="wish"]').forEach(п => {
    if (п !== откуда && п.value !== settings.musicWish) п.value = settings.musicWish;
    const x = п.parentElement.querySelector('[data-mu="wish-clear"]');
    if (x) x.hidden = !settings.musicWish;
  });
  if (сохранить && основа && typeof основа.saveSettings === 'function') основа.saveSettings();
}

function сменитьЧислоТреков(шаг) {
  settings.musicCount = Math.max(4, Math.min(12, числоТреков() + шаг));
  document.querySelectorAll('.hud-music-cnt').forEach(эл => {
    эл.querySelector('b').textContent = settings.musicCount;
    эл.querySelector('[data-d="-1"]').disabled = settings.musicCount <= 4;
    эл.querySelector('[data-d="1"]').disabled = settings.musicCount >= 12;
  });
  if (основа && typeof основа.saveSettings === 'function') основа.saveSettings();
}

// Часть плейлиста: заголовок с кнопкой «заново», треки, а пока пусто —
// крупная кнопка «подобрать». Подбирается часть отдельным запросом.
// доп — строка под треками (радио в сцене): есть она — части не пусто.
function частьПлейлиста({ часть, заголовок, пояснение, треки, группа, текущий, занята, класс = '', доп = '' }) {
  const кнопка = (подпись, крупная) => `<button type="button" class="${крупная ? 'hud-music-btn hud-music-get' : 'hud-music-act hud-music-re'}" data-mu="part" data-part="${часть}" title="Отдельный запрос к модели — только эта часть"${занята ? ' disabled' : ''}>${ико(крупная ? 'note' : 'redo')}${крупная ? escapeHtml(подпись) : ''}</button>`;
  const голова = `<div class="hud-music-sec${класс}"><b>${ико(часть === 'scene' ? 'speaker' : 'note')}${заголовок}</b><span>${пояснение}</span>${(треки.length || доп) && !занята ? кнопка('', false) : ''}</div>`;
  if (занята) return голова + '<div class="hud-music-wait"><i aria-hidden="true"></i>Подбираю…</div>';
  // Пусто: радио в сцене заменяет кнопку подбора (сцену уже подбирали), фон
  // саундтрека стоит под ней — он есть всегда.
  if (!треки.length) return голова + (доп && часть === 'scene' ? доп : `<div class="hud-music-blank">${кнопка(часть === 'scene' ? 'Подобрать музыку в сцене' : 'Подобрать саундтрек', true)}</div>` + доп);
  return голова + `<ol class="hud-music-tracks">${треки.map((т, k) => строкаТрека(т, k, группа, т === текущий)).join('')}</ol>` + доп;
}

// ---------------------------------------------------------------------------
// РАДИО В СЦЕНЕ (music-radio.js): живой эфир по тегам модели
// ---------------------------------------------------------------------------
// Станции ищутся по нажатию и держатся в памяти, пока открыт чат: ход хранит
// только теги и страну. Играет тот же плеер, группа 'r'.
const радиоХода = new Map();   // mesid → { станции, k, грузится, ошибка }
const радиоВключено = () => плеерВключён() && settings.musicRadio !== false;
const тегиРадиоХода = (м) => (м && м.scene && м.scene.radio) || '';

function радиоСтрока(i, м) {
  const теги = тегиРадиоХода(м);
  if (!теги || !радиоВключено()) return '';
  const р = радиоХода.get(i);
  const k = р ? р.k : 0;
  const ст = р && р.станции && р.станции[k];
  const откуда = ст ? (ст.src === 'record' ? 'Радио Рекорд' : (ст.страна ? ст.страна + ' · ' : '') + 'radio-browser') : '';
  const под = [escapeHtml(теги), р && р.ошибка ? escapeHtml(р.ошибка) : р && р.грузится ? 'ищу станцию…' : 'живой эфир', откуда].filter(Boolean).join(' · ');
  const т = { a: ст ? ст.name : 'Радио', t: 'Радио' };
  return `<div class="hud-music-radio${игра.mesid === i && игра.g === 'r' ? ' is-on' : ''}"><span class="hud-music-radio-ico">${ико('radio')}</span>`
    + `<span class="hud-music-radio-tt"><b>${escapeHtml(ст ? ст.name : 'Радио в сцене')}</b><em>${под}</em></span>`
    + кнопкаИгры('r', k, т)
    + `<button type="button" class="hud-music-act" data-mu="radio-next" title="Другая станция" aria-label="Другая станция"${р && р.грузится ? ' disabled' : ''}>${ико('redo')}</button></div>`;
}

// Станции хода: Рекорд — сразу из списка, станции мира — запросом.
async function станцииХода(индекс) {
  const ctx = контекст();
  const м = музыкаХода(ctx && ctx.chat && ctx.chat[индекс]);
  const теги = тегиРадиоХода(м);
  if (!теги) return null;
  let р = радиоХода.get(индекс);
  if (!р) { р = { станции: null, k: 0, грузится: false, ошибка: '' }; радиоХода.set(индекс, р); }
  if (р.станции) return р;
  // Уже ищется заранее — нажатие ждёт тот же поиск.
  if (р.загрузка) return р.загрузка;
  // Полосу не перерисовываем на старте: поиск идёт и заранее, при раскрытии
  // плейлиста, — перерисовка сбила бы ввод пожелания.
  р.грузится = true; р.ошибка = '';
  р.загрузка = (async () => {
    try { р.станции = await станцииСцены(теги, м.scene.country || ''); } catch (_) { р.станции = []; }
    р.грузится = false;
    р.загрузка = null;
    if (!р.станции.length) р.ошибка = 'станция не нашлась';
    обновитьПолосу(индекс);
    return р;
  })();
  return р.загрузка;
}

/** Включить радио хода; шаг — другая станция (1 — следующая). */
async function играйРадио(индекс, шаг = 0) {
  индекс = Number(индекс);
  const р = await станцииХода(индекс);
  if (!р || !р.станции || !р.станции.length) return;
  р.k = (р.k + шаг + р.станции.length) % р.станции.length;
  await играть(индекс, 'r', р.k);
}

// ---------------------------------------------------------------------------
// ФОН СЦЕНЫ ЦЕЛИКОМ (music-free.js): Фонау, Audius, Incompetech, Commons
// ---------------------------------------------------------------------------
// Очередь полных свободных треков по настроению сцены — без запроса к модели.
// Собирается по нажатию (и заранее, при раскрытии плейлиста), держится в
// памяти, пока открыт чат. Играет тот же плеер, группа 'f', по кругу.
const фонХода = new Map();   // mesid → { треки, k, грузится, ошибка, запрос }
const фонВключён = () => плеерВключён() && settings.musicFree !== false;
const источникиФона = () => ({ fonau: settings.musicFreeFonau !== false, audius: settings.musicFreeAudius !== false, incompetech: settings.musicFreeIncompetech !== false, commons: settings.musicFreeCommons !== false });
const ИМЕНА_РОДОВ = { страх: 'тревожное', ярость: 'ярость', грусть: 'грустное', страсть: 'страсть', нежность: 'нежное', веселье: 'весёлое', тайна: 'загадочное', подъём: 'эпичное', неловкость: 'забавное', покой: 'спокойное', бой: 'бой' };

// Сцена для фона: та, под которую подобрана музыка, иначе — из HUD хода.
function сценаФона(индекс) {
  const ctx = контекст();
  const message = ctx && ctx.chat && ctx.chat[индекс];
  const м = музыкаХода(message);
  if (м && м.сцена) return м.сцена;
  const d = message ? данныеHUD(message) : null;
  return d ? сценаИзHUD(d) : null;
}

async function трекиФона(индекс) {
  let ф = фонХода.get(индекс);
  if (!ф) { ф = { треки: null, k: 0, грузится: false, ошибка: '', запрос: null }; фонХода.set(индекс, ф); }
  if (ф.треки) return ф;
  // Уже ищется (заранее, при раскрытии) — нажатие ждёт тот же поиск, а не
  // уходит ни с чем.
  if (ф.загрузка) return ф.загрузка;
  const сцена = сценаФона(индекс);
  if (!сцена) { ф.ошибка = 'нет сцены'; return ф; }
  ф.грузится = true; ф.ошибка = '';
  ф.загрузка = (async () => {
    try {
      const итог = await собратьФон(сцена, { источники: источникиФона() });
      ф.треки = итог.треки.filter(т => !вСписке(запретыИгрока(), т));
      ф.запрос = итог.запрос;
    } catch (_) { ф.треки = []; }
    ф.грузится = false;
    ф.загрузка = null;
    if (!ф.треки.length) ф.ошибка = 'свободные треки не нашлись';
    обновитьПолосу(индекс);
    return ф;
  })();
  return ф.загрузка;
}

/** Забыть собранные очереди фона: сменили источники в настройках. */
export function сброситьФон() { фонХода.clear(); }

/** Включить фон сцены; шаг — другой трек (1 — следующий). */
async function играйФон(индекс, шаг = 0) {
  индекс = Number(индекс);
  const ф = await трекиФона(индекс);
  if (!ф || !ф.треки || !ф.треки.length) return;
  ф.k = (ф.k + шаг + ф.треки.length) % ф.треки.length;
  await играть(индекс, 'f', ф.k);
}

function фонСтрока(i) {
  if (!фонВключён()) return '';
  const ф = фонХода.get(i);
  const играет = игра.mesid === i && игра.g === 'f';
  const k = ф ? ф.k : 0;
  const т = играет && ф && ф.треки ? ф.треки[игра.i] : null;
  const сцена = (ф && ф.запрос) || null;
  const настроение = сцена && сцена.род ? ИМЕНА_РОДОВ[сцена.род] || '' : '';
  const источники = Object.entries(источникиФона()).filter(([, вкл]) => вкл).map(([k2]) => ИМЕНА_ИСТОЧНИКОВ[k2]);
  const под = т ? [т.a, ИМЕНА_ИСТОЧНИКОВ[т.src] || ''].filter(Boolean).map(escapeHtml).join(' · ')
    : [настроение && escapeHtml(настроение), ф && ф.ошибка ? escapeHtml(ф.ошибка) : ф && ф.грузится ? 'ищу треки…' : 'полные треки без пауз', !ф || !ф.ошибка ? escapeHtml(источники.join(', ')) : ''].filter(Boolean).join(' · ');
  const тр = т || { a: 'Фон сцены', t: 'Фон сцены' };
  const лайк = т && вСписке(лайкиИгрока(), т), запрет = т && вСписке(запретыИгрока(), т);
  return `<div class="hud-music-radio hud-music-free${играет ? ' is-on' : ''}"><span class="hud-music-radio-ico">${ико('waves')}</span>`
    + `<span class="hud-music-radio-tt"><b>${escapeHtml(т ? т.t : 'Фон сцены — целиком')}</b><em>${под}</em></span>`
    + (т ? `<span class="hud-music-taste">${кнопкаЛайка(т, 'f', игра.i, лайк)}${кнопкаЗапрета(т, 'f', игра.i, запрет)}</span>` : '')
    + кнопкаИгры('f', играет ? игра.i : k, тр)
    + `<button type="button" class="hud-music-act" data-mu="free-next" title="Следующий трек фона" aria-label="Следующий трек фона"${ф && ф.грузится ? ' disabled' : ''}>${ико('skip')}</button></div>`;
}

/** Полоса музыки для карточки хода; '' — показывать нечего. занято и
 *  ошибка — подмена состояния подбора для стенда (tests/tools). */
export function полосаМузыки(индекс, { chat = null, открыта = false, занято: занятоСтенд = null, ошибка: ошибкаСтенд = null } = {}) {
  if (!settings.enableMusic) return '';
  const ctx = chat ? null : контекст();
  const список = chat || (ctx && Array.isArray(ctx.chat) ? ctx.chat : null);
  const i = Number(индекс);
  const message = список && Number.isInteger(i) ? список[i] : null;
  if (!message || message.is_user) return '';
  const вид = видПолосы();
  const ключ = ключХода(ctx || контекст(), i, message);
  const м = музыкаХода(message);
  const занято = занятоСтенд ? { части: занятоСтенд } : идут.get(ключ);
  const ошибка = ошибкаСтенд || ошибки.get(ключ);
  // Без подборки полоса видна только у последнего хода: на старых она была
  // бы шумом. Подбор и ошибку показываем там, где они случились.
  if (!м && !занято && !ошибка && i !== список.length - 1) return '';
  const занятыЧасти = занято ? занято.части : [];
  const саундтрек = м && Array.isArray(м.soundtrack) ? м.soundtrack : [];
  const вСцене = м && м.scene && Array.isArray(м.scene.tracks) ? м.scene.tracks : [];
  const [гр, н] = м && Array.isArray(м.now) ? м.now : ['s', 0];
  // Играет радио этого хода — оно и «сейчас играет».
  const радио = игра.mesid === i && игра.g === 'r' ? трекиГруппы(i, 'r')[игра.i] || null : null;
  // Играет фон сцены — он «сейчас играет», со своим исполнителем.
  const фон = игра.mesid === i && игра.g === 'f' ? трекиГруппы(i, 'f')[игра.i] || null : null;
  const текущий = радио || фон || (гр === 'c' ? вСцене : саундтрек)[н] || саундтрек[0] || вСцене[0] || null;
  const все = [...саундтрек, ...вСцене];
  const найдено = все.filter(т => т.ok === true).length;
  const ненайдено = все.filter(т => т.ok === false).length;
  const мета = !м ? '' : [
    м.from !== undefined ? 'та же сцена — подборка с хода ' + (Number(м.from) + 1) : м.why ? 'подобрано: ' + escapeHtml(м.why) : '',
    найдено ? 'проверено поиском: ' + найдено : '',
    ненайдено ? 'не найдено: ' + ненайдено : '',
    м.dropped ? 'отброшено ненайденных: ' + м.dropped : '',
    м.meme ? 'мемный саундтрек' : '',
  ].filter(Boolean).join(' · ');
  const состояние = (занято ? ' is-busy' : '') + (!все.length && !занято ? ' is-empty' : '') + (ошибка ? ' is-error' : '') + (открыта ? ' is-open' : '') + классИгры(i);
  const группаТекущего = радио ? 'r' : фон ? 'f' : вСцене.includes(текущий) ? 'c' : 's';
  const номерТекущего = радио || фон ? игра.i : текущий ? (группаТекущего === 'c' ? вСцене : саундтрек).indexOf(текущий) : -1;
  const подпись = занято ? 'Подбираю: ' + занятыЧасти.map(ч => ИМЕНА_ЧАСТЕЙ[ч]).join(', ')
    : ошибка ? 'Не получилось' : радио ? 'Радио в сцене' : фон ? 'Фон сцены' : текущий ? (вСцене.includes(текущий) ? 'Звучит в сцене' : 'Сейчас играет') : 'Музыка сцены';
  const заглавие = радио ? радио.a : текущий ? текущий.t : ошибка ? обрезать(ошибка, 120) : занято ? 'Подбираю музыку…' : 'Подобрать музыку к сцене';
  const метка = м && м.label;
  return `<div class="hud-music is-${вид}${состояние}" data-mesid="${i}">`
    + `<div class="hud-music-bar" role="button" tabindex="0" data-mu="open" aria-expanded="${открыта}" title="Показать плейлист">`
    + обложка(вид, текущий && текущий.art)
    + `<span class="hud-music-now"><small${метка ? ' class="has-label"' : ''}><span class="hud-music-kind">${escapeHtml(подпись)}</span>${метка ? `<i class="hud-music-tag-inline">${escapeHtml(метка)}</i>` : ''}</small>`
    + `<b>${escapeHtml(заглавие)}</b>${радио ? `<em>${escapeHtml(радио.жанры || тегиРадиоХода(м) || 'живой эфир')}</em>` : текущий ? `<em>${escapeHtml(текущий.a)}</em>` : ''}</span>`
    + (метка ? `<span class="hud-music-tag">${escapeHtml(метка)}</span>` : '')
    + (занято ? `<button type="button" class="hud-music-act" data-mu="cancel" title="Отменить подбор">${ико('stop')}</button>` : '')
    + (текущий ? кнопкаИгры(группаТекущего, номерТекущего, текущий) : '')
    + `<span class="hud-music-chev" aria-hidden="true">${ико('chev')}</span><i class="hud-music-prog" aria-hidden="true"><b></b></i></div>`
    + `<div class="hud-music-list">`
    + частьПлейлиста({ часть: 'soundtrack', заголовок: 'Саундтрек', пояснение: 'для вас, как в кино' + (саундтрек.length ? ' · ' + сЧислом(саундтрек.length, ['трек', 'трека', 'треков']) : ''), треки: саундтрек, группа: 's', текущий, занята: занятыЧасти.includes('soundtrack'), доп: фонСтрока(i) })
    + частьПлейлиста({ часть: 'scene', заголовок: 'В сцене', пояснение: escapeHtml((м && м.scene && м.scene.src) || 'то, что слышат герои') + (settings.musicSceneLine && вСцене.length ? ' · модель знает' : ''), треки: вСцене, группа: 'c', текущий, занята: занятыЧасти.includes('scene'), класс: ' is-scene', доп: радиоСтрока(i, м) })
    + строкаНастроек()
    + `<div class="hud-music-foot">`
    + (саундтрек.length ? `<button type="button" class="hud-music-btn hud-music-mt" data-mu="queue-all">${ико('queue')}Всё в очередь MoodTube</button>` : '')
    + `<button type="button" class="hud-music-btn" data-mu="redo" title="Один отдельный запрос к модели на все части"${занято ? ' disabled' : ''}>${ико('redo')}${все.length ? 'Подобрать всё заново' : 'Подобрать всё сразу'}</button>`
    // Мемы — разово, только саундтрек: смешная сцена, абсурд, разрядка.
    + `<button type="button" class="hud-music-btn hud-music-meme${м && м.meme ? ' is-on' : ''}" data-mu="meme" title="${м && м.meme ? 'Подобрать саундтрек заново, без мемов' : 'Мемные звуки и песни вместо саундтрека — для смешной или абсурдной сцены. Один раз, отдельным запросом'}"${занято ? ' disabled' : ''}>${ико('meme')}${м && м.meme ? 'Без мемов' : 'Мемы'}</button>`
    + (мета ? `<span class="hud-music-meta">${мета}</span>` : '') + `</div>`
    + `</div></div>`;
}

/** Перерисовать полосу в карточке хода (после подборки, отмены, ошибки). */
export function обновитьПолосу(индекс) {
  const ctx = контекст();
  const chat = ctx && Array.isArray(ctx.chat) ? ctx.chat : [];
  const mes = document.querySelector(`#chat .mes[mesid="${Number(индекс)}"]`);
  const карточка = mes && mes.querySelector('.hud-os-card');
  if (!карточка) return;
  // Экран «Музыки» в телефоне — если вкладку уже собрали.
  mes.querySelectorAll('.hud-mphone').forEach(эк => { эк.outerHTML = приложениеМузыки(индекс, эк.dataset.owner || '', { chat }); });
  const старая = карточка.querySelector('.hud-music');
  const html = полосаМузыки(индекс, { chat, открыта: !!(старая && старая.classList.contains('is-open')) });
  if (старая) { if (html) старая.outerHTML = html; else старая.remove(); if (игра.mesid === Number(индекс)) обновитьЗначок(); return; }
  if (!html) return;
  const якорь = карточка.querySelector('.hud-tabs-header');
  if (якорь) якорь.insertAdjacentHTML('beforebegin', html);
  if (игра.mesid === Number(индекс)) обновитьЗначок();
}

// ---------------------------------------------------------------------------
// ПЛЕЕР: 30-секундные отрывки из каталога iTunes
// ---------------------------------------------------------------------------
// Целиком трек браузеру без сторонних сервисов не достать: YouTube в России —
// через нестабильные зеркала, Spotify в браузере — только с Premium и входом,
// у Яндекс Музыки нет открытого API. Отрывки iTunes открыты, лежат на CDN
// Apple и играются обычным <audio> — их и играем. Целиком — по ссылке или
// через MoodTube. Звук один на страницу: новый трек сменяет прежний.

const игра = { audio: null, mesid: null, g: null, i: -1, играет: false, грузится: false, длина: 30, полный: false, трек: null, запасные: [] };

// Полоса играет саундтрек, музыку в сцене и радио; экран телефона — свои
// треки: недавнее ('p'), плейлисты ('pl:<id>') и «Нравится» ('pf:<id владельца>').
export const этоТелефон = (г) => typeof г === 'string' && г[0] === 'p';
const классИгры = (индекс, телефон = false) => игра.mesid !== Number(индекс) || этоТелефон(игра.g) !== телефон ? '' : (игра.g === 'r' ? ' is-live' : '') + (игра.грузится ? ' is-loading' : игра.играет ? ' is-playing' : ' is-paused');

function трекиГруппы(индекс, группа) {
  if (группа === 'p') { const т = музыкаТелефона(индекс); return т ? т.tracks : []; }
  if (typeof группа === 'string' && группа.startsWith('pl:')) { const н = плейлистПоId(библиотекаЧата(), группа.slice(3)); return н ? н.п.tracks : []; }
  if (typeof группа === 'string' && группа.startsWith('pf:')) { const н = записьПоId(библиотекаЧата(), группа.slice(3)); return н ? н.з.liked : []; }
  if (группа === 'f') { const ф = фонХода.get(Number(индекс)); return ф && ф.треки ? ф.треки : []; }
  if (группа === 'r') { const р = радиоХода.get(Number(индекс)); return р && р.станции ? р.станции.map(ст => ({ a: ст.name, t: 'Радио', радио: true, поток: ст.url, жанры: String(ст.жанры || '').toLowerCase().split(',').map(ж => ж.trim()).filter(Boolean).join(', ') })) : []; }
  const ctx = контекст();
  const м = музыкаХода(ctx && ctx.chat && ctx.chat[индекс]);
  if (!м) return [];
  return (группа === 'c' ? м.scene && м.scene.tracks : м.soundtrack) || [];
}

// Полный трек — по выбору игрока, через неофициальный посредник к NetEase
// Cloud Music (music-api.gdstudio.xyz — тот же, что в регексах-плеерах).
// Он может пропасть или не найти песню, ему уходят исполнитель и название, а
// ссылка на поток живёт недолго — поэтому её не храним, а берём при игре и
// держим в памяти десять минут. Не нашёлся — играем отрывок iTunes.
const ПОСРЕДНИК = 'https://music-api.gdstudio.xyz/api.php';
const полныеСсылки = new Map();   // ключ трека → { адрес, когда }
// Полный трек: NetEase (full) или YouTube через зеркала (youtube).
export const полныйИсточник = () => settings.musicSource === 'full' || settings.musicSource === 'youtube';

// YouTube через зеркала Invidious — идея MoodTube, но звук играет наш плеер.
// Прямые ссылки YouTube привязаны к адресу зеркала и с чужого не открываются,
// поэтому звук идёт через само зеркало: /latest_version?…&local=true — его
// <audio> играет как обычный файл. Зеркала живут недолго: список берём из
// общего каталога Invidious (по здоровью) и держим запасные адреса.
const ЗАПАСНЫЕ_ЗЕРКАЛА = ['https://yt.chocolatemoo53.com', 'https://inv.nadeko.net', 'https://invidious.nerdvpn.de', 'https://yewtu.be', 'https://invidious.tiekoetter.com', 'https://invidious.private.coffee'];
let зеркала = null, зеркалаКогда = 0;
async function зеркалаInvidious() {
  if (зеркала && Date.now() - зеркалаКогда < 60 * 60 * 1000) return зеркала;
  let каталог = [];
  try {
    const j = await получить('https://api.invidious.io/instances.json?sort_by=health');
    каталог = (Array.isArray(j) ? j : []).filter(([, и]) => и && и.type === 'https' && и.api !== false && и.uri)
      .map(([, и]) => String(и.uri).replace(/\/+$/, '')).filter(u => /^https:\/\/[\w.-]+$/.test(u));
  } catch (_) { /* каталог недоступен — запасные */ }
  зеркала = [...new Set([...каталог, ...ЗАПАСНЫЕ_ЗЕРКАЛА])].slice(0, 10);
  зеркалаКогда = Date.now();
  return зеркала;
}

/** Лучшее видео из выдачи: то же название и исполнитель, без каверов,
 *  ремиксов и часовых зацикленных версий; канал «… - Topic» — сам релиз. */
export function лучшееВидео(т, выдача) {
  const nt = нормНазв(т.t), na = норм(т.a), исходник = нижн(т.t);
  const очки = (v) => {
    const название = норм(v.title), канал = норм(v.author).replace(/ topic$/, '');
    // Название и исполнитель — обязательны: «Time» у другого артиста — не тот трек.
    if (!название.includes(nt)) return -99;
    if (!(канал.includes(na) || (канал && na.includes(канал)) || название.includes(na))) return -99;
    let о = 6;
    if (/ topic$/.test(норм(v.author))) о += 2;
    if (/official audio|\baudio\b/.test(название)) о += 1;
    for (const слово of ['live', 'cover', 'karaoke', 'remix', 'sped up', 'slowed', 'nightcore', 'reaction', '8d', 'lyrics', 'instrumental']) {
      if (название.includes(слово) && !исходник.includes(слово)) о -= 3;
    }
    return о;
  };
  const годные = (Array.isArray(выдача) ? выдача : []).filter(v => v && /^[\w-]{11}$/.test(String(v.videoId || '')) && (!v.lengthSeconds || (v.lengthSeconds >= 45 && v.lengthSeconds <= 900)));
  const лучшее = годные.map(v => [очки(v), v]).sort((a, b) => b[0] - a[0])[0];
  return лучшее && лучшее[0] >= 5 ? String(лучшее[1].videoId) : '';
}

const видеоYouTube = new Map();   // ключ трека → { id, зеркало }
async function потокиYouTube(т) {
  const k = ключТрека(т);
  const зерк = await зеркалаInvidious();
  let н = видеоYouTube.get(k);
  if (!н) {
    for (const з of зерк.slice(0, 5)) {
      try {
        const j = await получить(з + '/api/v1/search?' + new URLSearchParams({ q: т.a + ' ' + т.t, type: 'video', fields: 'videoId,title,author,lengthSeconds' }));
        if (!Array.isArray(j)) continue;
        н = { id: лучшееВидео(т, j), зеркало: з };
        видеоYouTube.set(k, н);
        break;
      } catch (_) { /* следующее зеркало */ }
    }
  }
  if (!н || !н.id) return [];
  // Сначала зеркало, которое нашло видео, потом остальные — запасными.
  return [н.зеркало, ...зерк.filter(з => з !== н.зеркало)].slice(0, 4)
    .map(з => з + '/latest_version?' + new URLSearchParams({ id: н.id, itag: '140', local: 'true' }));
}

// Адреса полного трека по выбранному источнику; пусто — играет отрывок.
async function потокиТрека(т) {
  if (settings.musicSource === 'full') { const u = await полныйТрек(т); return u ? [u] : []; }
  if (settings.musicSource === 'youtube') return потокиYouTube(т);
  return [];
}
// MoodTube играет трек целиком своим плеером (YouTube через зеркала Piped и
// Invidious или Spotify Premium). Наш звук при этом молчит.
const черезMoodTube = () => settings.musicSource === 'moodtube';
async function полныйТрек(т) {
  const ключ = ключТрека(т);
  const было = полныеСсылки.get(ключ);
  if (было && Date.now() - было.когда < 10 * 60 * 1000) return было.адрес;
  const ждать = (мс) => { const c = new AbortController(); setTimeout(() => c.abort(), мс); return c.signal; };
  const поиск = т.ne ? [{ id: т.ne, name: т.t, artist: [т.a] }] : await fetch(ПОСРЕДНИК + '?' + new URLSearchParams({ types: 'search', count: '8', source: 'netease', name: т.a + ' ' + т.t }), { credentials: 'omit', referrerPolicy: 'no-referrer', signal: ждать(6000) }).then(r => r.json());
  // Тот же исполнитель и то же название — по тем же правилам, что и сверка iTunes.
  const найден = (Array.isArray(поиск) ? поиск : []).find(x => x && x.id && совпадение(т, [{ artistName: (Array.isArray(x.artist) ? x.artist : [x.artist]).filter(Boolean).join(', '), trackName: x.name }]));
  if (!найден || !найден.id) return '';
  // 320 кбит/с, а не FLAC: на телефоне трек в 45 МБ — это лишний трафик.
  const поток = await fetch(ПОСРЕДНИК + '?' + new URLSearchParams({ types: 'url', id: String(найден.id), source: 'netease', br: '320' }), { credentials: 'omit', referrerPolicy: 'no-referrer', signal: ждать(6000) }).then(r => r.json());
  const адрес = поток && typeof поток.url === 'string' && /^https:\/\/[\w.-]+\.(?:126\.net|163\.com)\//.test(поток.url) ? поток.url : '';
  if (адрес) полныеСсылки.set(ключ, { адрес, когда: Date.now() });
  return адрес;
}

// Раскрыли плейлист — заранее находим полные треки первых строк: телефон
// включает звук только сразу после нажатия, а два запроса к сервису —
// несколько секунд. С готовой ссылкой ▶ играет с первого раза.
const греются = new Set();
function прогреть(индекс) {
  // Станции радио — заранее: телефон включает звук только сразу после нажатия.
  if (радиоВключено()) станцииХода(Number(индекс)).catch(() => {});
  if (фонВключён()) трекиФона(Number(индекс)).catch(() => {});
  if (!плеерВключён() || !полныйИсточник()) return;
  const треки = [...трекиГруппы(индекс, 's').slice(0, 3), ...трекиГруппы(индекс, 'c').slice(0, 1)].filter(т => т && т.ok !== false);
  (async () => {
    for (const т of треки) {
      const k = ключТрека(т);
      if (греются.has(k)) continue;
      греются.add(k);
      try { await потокиТрека(т); } catch (_) { /* не нашлось — сыграет отрывок */ }
      греются.delete(k);
    }
  })();
}

// У подборок, сделанных до плеера, отрывка нет — находим тем же поиском.
async function отрывок(т) {
  if (т.pv) return т.pv;
  try {
    const н = await искатьВiTunes(т);
    if (н && н.pv) { т.pv = н.pv; if (!т.art && н.art) т.art = н.art; return н.pv; }
  } catch (_) { /* каталог недоступен */ }
  return '';
}

function звук() {
  if (игра.audio) return игра.audio;
  const a = new Audio();
  a.preload = 'none';
  a.addEventListener('playing', () => { игра.играет = true; игра.грузится = false; игра.радиоПопыток = 0; игра.фонПопыток = 0; отметитьИгру(); });
  // Полоска хода — по настоящей длине: у отрывка 30 с, у полного трека минуты.
  a.addEventListener('loadedmetadata', () => { if (игра.g !== 'r') игра.длина = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : 30; отметитьИгру(); });
  a.addEventListener('pause', () => { игра.играет = false; отметитьИгру(); });
  a.addEventListener('ended', () => {
    игра.играет = false;
    // Отрывок кончился (полного трека нет) — дальше фон сцены целиком, без пауз.
    if ((игра.g === 's' || игра.g === 'c') && !игра.полный && фонВключён() && settings.musicFreeAfter !== false) { играйФон(игра.mesid, фонХода.has(игра.mesid) ? 1 : 0); return; }
    следующий(1, true);
  });
  a.addEventListener('error', () => {
    if (!a.getAttribute('src')) return;
    // Свободный трек не загрузился — следующий, но не бесконечно.
    if (игра.g === 'f') {
      игра.фонПопыток = (игра.фонПопыток || 0) + 1;
      if (игра.фонПопыток <= 5) { играйФон(игра.mesid, 1); return; }
      игра.играет = false; игра.грузится = false; отметитьИгру();
      показать('info', 'Музыка', 'Свободные треки не загрузились — попробуйте позже.');
      return;
    }
    // Станция молчит — следующая, но не по кругу бесконечно.
    if (игра.g === 'r') {
      игра.радиоПопыток = (игра.радиоПопыток || 0) + 1;
      if (игра.радиоПопыток <= 4) { показать('info', 'Радио', 'Станция не отвечает — включаю другую.'); играйРадио(игра.mesid, 1); return; }
      игра.играет = false; игра.грузится = false; отметитьИгру();
      показать('info', 'Радио', 'Ни одна станция не ответила — попробуйте позже.');
      return;
    }
    // Не загрузился: следующее зеркало, а когда они кончились — отрывок.
    if (игра.запасные && игра.запасные.length) { a.src = игра.запасные.shift(); a.play().catch(() => {}); return; }
    if (игра.полный && игра.трек) {
      const т = игра.трек;
      игра.полный = false;
      отрывок(т).then(u => {
        if (игра.трек !== т) return;
        if (u) { показать('info', 'Музыка', 'Полная версия не загрузилась — играет отрывок 30 с.'); a.src = u; a.play().catch(() => {}); }
        else { игра.играет = false; игра.грузится = false; отметитьИгру(); показать('info', 'Музыка', 'Трек не загрузился — откройте его по ссылке.'); }
      });
      return;
    }
    игра.играет = false; игра.грузится = false; отметитьИгру();
    показать('info', 'Музыка', 'Трек не загрузился — откройте его по ссылке.');
  });
  игра.audio = a;
  return a;
}

// Отметки на странице без пересборки: полоса, экран телефона, кнопки.
function отметитьИгру() {
  обновитьЗначок();
  document.querySelectorAll(':is(.hud-music, .hud-mphone):is(.is-playing, .is-paused, .is-loading)').forEach(эл => эл.classList.remove('is-playing', 'is-paused', 'is-loading'));
  document.querySelectorAll('[data-mu="play"].is-on').forEach(б => б.classList.remove('is-on'));
  if (игра.mesid === null) return;
  const класс = классИгры(игра.mesid, этоТелефон(игра.g)).trim();
  const где = этоТелефон(игра.g) ? '.hud-mphone' : '.hud-music';
  const длина = Math.round(игра.длина || 30) + 's';
  document.querySelectorAll(`#chat .mes[mesid="${игра.mesid}"] ${где}`).forEach(эл => {
    // Класс бывает и из двух слов: «is-live is-loading» у радио.
    for (const к of класс.split(' ').filter(Boolean)) эл.classList.add(к);
    if (эл.style.getPropertyValue('--mu-dur') !== длина) эл.style.setProperty('--mu-dur', длина);
    эл.querySelectorAll(`[data-mu="play"][data-g="${игра.g}"][data-i="${игра.i}"]`).forEach(б => б.classList.add('is-on'));
  });
}

// Экран блокировки и гарнитура телефона: название, обложка, «дальше».
function медиаСессия(т) {
  const ms = typeof navigator !== 'undefined' && navigator.mediaSession;
  if (!ms || typeof MediaMetadata !== 'function') return;
  try {
    ms.metadata = т.радио
      ? new MediaMetadata({ title: т.a, artist: т.жанры || 'Радио', album: 'Радио в сцене — HUD', artwork: [] })
      : new MediaMetadata({ title: т.t, artist: т.a, album: 'Музыка сцены — HUD', artwork: т.art ? [{ src: т.art, sizes: '200x200', type: 'image/jpeg' }] : [] });
    ms.setActionHandler('play', () => игра.audio && игра.audio.play().catch(() => {}));
    ms.setActionHandler('pause', () => игра.audio && игра.audio.pause());
    ms.setActionHandler('nexttrack', () => следующий(1));
    ms.setActionHandler('previoustrack', () => следующий(-1));
  } catch (_) { /* старый браузер */ }
}

/** Играть отрывок трека; тот же трек — пауза или продолжение. */
export async function играть(индекс, группа, i) {
  индекс = Number(индекс); i = Number(i);
  const т = трекиГруппы(индекс, группа)[i];
  if (!т) return;
  const a = звук();
  if (игра.mesid === индекс && игра.g === группа && игра.i === i && a.getAttribute('src')) {
    if (a.paused) a.play().catch(() => {}); else a.pause();
    return;
  }
  if (черезMoodTube()) {
    const api = moodTube();
    if (api && typeof api.playQuery === 'function') {
      остановитьИгру();
      показать('info', 'MoodTube', 'Ищу и включаю: ' + т.a + ' — ' + т.t);
      try {
        if (await api.playQuery(т.a + ' - ' + т.t)) { показать('success', 'MoodTube', 'Играет целиком в MoodTube'); return; }
        показать('info', 'MoodTube', 'MoodTube не нашёл трек — играет отрывок.');
      } catch (e) { показать('info', 'MoodTube', 'MoodTube не включил трек — играет отрывок.'); }
    } else показать('info', 'MoodTube', 'MoodTube не установлен — играет отрывок.');
  }
  // MoodTube играет своё — ставим на паузу: две музыки разом не нужны.
  const мт = moodTube();
  try { if (мт && мт.isPlaying && мт.isPlaying() && мт.togglePlayPause) мт.togglePlayPause(); } catch (_) { /* не помешает */ }
  a.pause();
  Object.assign(игра, { mesid: индекс, g: группа, i, играет: false, грузится: true });
  // Полоса показывает играющий трек.
  if (группа === 's' || группа === 'c') поставитьСейчас(индекс, группа, i); else обновитьПолосу(индекс);
  отметитьИгру();
  // Известный отрывок ставим сразу, в том же нажатии: телефоны не дают
  // включить звук после ожидания сети.
  let адреса = [];
  // Радио — живой эфир: у него свой поток, ни отрывков, ни поиска.
  if (т.поток) адреса = [т.поток];
  else if (полныйИсточник()) {
    try { адреса = (await потокиТрека(т)).filter(Boolean); } catch (_) { /* сервис недоступен — отрывок */ }
  }
  const полный = адреса.length > 0;
  if (!полный) { const п = т.pv || await отрывок(т); if (п) адреса = [п]; }
  if (игра.mesid !== индекс || игра.g !== группа || игра.i !== i) return;
  if (полныйИсточник() && !полный && адреса.length && !т.поток) показать('info', 'Музыка', 'Полной версии «' + т.t + '» не нашлось — играет отрывок 30 с.');
  // Остальные адреса — запасные: зеркало не отдало звук — следующее, потом отрывок.
  Object.assign(игра, { полный, трек: т, запасные: адреса.slice(1), длина: группа === 'r' ? 0 : полный ? игра.длина : 30 });
  const адрес = адреса[0] || '';
  if (!адрес) {
    игра.грузится = false; отметитьИгру();
    показать('info', 'Музыка', 'У «' + т.t + '» нет отрывка в каталоге — откройте трек по ссылке.');
    return;
  }
  a.src = адрес;
  a.volume = Math.max(0, Math.min(100, Number(settings.musicVolume ?? 70))) / 100;
  медиаСессия(т);
  try { await a.play(); }
  catch (e) {
    игра.грузится = false; отметитьИгру();
    if (e && e.name !== 'AbortError') показать('info', 'Музыка', 'Браузер не дал включить звук — нажмите ещё раз.');
  }
}

function следующий(шаг, сам = false) {
  if (игра.mesid === null) return;
  const треки = трекиГруппы(игра.mesid, игра.g);
  let n = игра.i + шаг;
  // Выдуманные (не найденные) пропускаем: отрывка у них нет. И то, что
  // игрок просил не предлагать.
  if (игра.g === 'f' && треки.length) n = (n + треки.length) % треки.length;
  while (n >= 0 && n < треки.length && (треки[n].ok === false || вСписке(запретыИгрока(), треки[n]))) n += шаг;
  if (n >= 0 && n < треки.length) играть(игра.mesid, игра.g, n);
  else if (сам) остановитьИгру();
}

/** Остановить и забыть играющий трек (смена чата, выключили плеер). */
export function остановитьИгру() {
  const a = игра.audio;
  if (a) { a.pause(); a.removeAttribute('src'); try { a.load(); } catch (_) { /* пусто */ } }
  Object.assign(игра, { mesid: null, g: null, i: -1, играет: false, грузится: false });
  отметитьИгру();
}

// ---------------------------------------------------------------------------
// ПРИЛОЖЕНИЕ «МУЗЫКА» В ТЕЛЕФОНЕ ПЕРСОНАЖА: что слушает он сам
// ---------------------------------------------------------------------------

// Музыка владельца — с этого хода или ближайшего прежнего: вкус не меняется
// каждый ход, а подборку телефона модель делает вместе с остальными частями.
export function музыкаТелефона(индекс, chat = null) {
  const список = chat || (контекст() || {}).chat || [];
  for (let i = Number(индекс); i >= 0 && i >= индекс - 60; i--) {
    const м = музыкаХода(список[i]);
    if (м && м.phone && Array.isArray(м.phone.tracks) && м.phone.tracks.length) return { ...м.phone, i };
  }
  return null;
}

// Библиотека телефона: плейлисты владельца с названиями и его «Нравится» —
// в метаданных чата (music-lib.js). Ключ владельца — имя без приставки
// карточки, как его пишет HUD.
export const ключВладельца = (v) => имяБезПриставки(String(v || '')) || String(v || '').trim();

// Что открыто в «Музыке» телефона: вкладка и плейлист. По ходу и владельцу:
// перерисовка экрана не должна выкидывать на «Недавно».
const видыТелефона = new Map();       // `${mesid}|${владелец}` → { вид, id, удалить }
const темыПлейлистов = new Map();     // владелец → тема нового плейлиста, пока её печатают
const идутПлейлисты = new Map();      // владелец → { отмена, что: 'new' | 'more', id }
const ошибкиПлейлистов = new Map();   // владелец → текст ошибки

function сохранитьМетаданные(ctx) {
  try {
    if (ctx && typeof ctx.saveMetadata === 'function') Promise.resolve(ctx.saveMetadata()).catch(e => console.warn('[TavernOS HUD] музыка: библиотека не сохранилась', e));
    else сохранитьЧат(ctx);
  } catch (e) { console.warn('[TavernOS HUD] музыка: библиотека не сохранилась', e); }
}

/** Перерисовать экраны «Музыки» в ленте (у одного владельца или у всех). */
export function обновитьТелефоны(владелец = null) {
  const ctx = контекст();
  const chat = ctx && Array.isArray(ctx.chat) ? ctx.chat : [];
  document.querySelectorAll('#chat .hud-mphone').forEach(эк => {
    if (владелец && ключВладельца(эк.dataset.owner) !== владелец) return;
    эк.outerHTML = приложениеМузыки(эк.dataset.mesid, эк.dataset.owner || '', { chat });
  });
  отметитьИгру();
}

// Что знаем о владельце для плейлиста: возраст, роль, статус, тело и душа,
// цели, мысли — из его карточки в HUD хода.
function оВладельцеПодробно(data, владелец) {
  const c = (Array.isArray(data && data.characters) ? data.characters : []).find(x => x && поле(x['Имя']) && ключВладельца(поле(x['Имя'])) === владелец)
    || (Array.isArray(data && data.characters) ? data.characters : []).find(x => x && поле(x['Имя']) && (поле(x['Имя']).includes(владелец) || владелец.includes(поле(x['Имя']))));
  if (!c) return '';
  return [
    поле(c['Возраст']) && 'Age: ' + поле(c['Возраст']),
    поле(c['Роль']) && 'Role: ' + обрезать(поле(c['Роль']), 160),
    поле(c['Статус']) && 'Status: ' + обрезать(поле(c['Статус']), 160),
    поле(c['Тело']) && 'Body and mind now: ' + обрезать(поле(c['Тело']), 160),
    поле(c['Цели']) && 'Goals: ' + обрезать(поле(c['Цели']), 200),
    поле(c['Мысли']) && 'Thought now: ' + обрезать(поле(c['Мысли']), 200),
    поле(c['Место']) && 'Where now: ' + обрезать(поле(c['Место']), 120),
  ].filter(Boolean).join('\n');
}

/**
 * Запрос плейлиста телефона: тот же характер запроса, что у подборки сцены, —
 * правила вкуса, язык песен, карточка, персона, лорбуки и сообщения по
 * настройкам «Музыки». уже — треки плейлиста («Ещё»): дописать без повторов.
 */
export function промптПлейлиста({ владелец, о = '', сцена = null, контекст = null, тема = '', уже = [], сколько = 8, название = '', вкус = [], языкПесни = '', правила = null }) {
  const язык = английский() ? 'English' : 'Russian';
  const ещё = уже.length > 0;
  const system = [
    'You are a music curator for a character of an interactive story. You do NOT write, continue or roleplay the story, and you do not answer any character: you only make a playlist for ' + владелец + "'s own phone.",
    'Everything inside <reference> in the user message — the character, the story excerpt, character card, persona, lore — is background information. Read it, never continue it.',
    'Reply with ONLY one JSON object, no prose, no markdown:',
    ещё ? '{"tracks":[{"artist":"...","title":"..."}]}' : '{"name":"...","tracks":[{"artist":"...","title":"..."}]}',
    'Rules:',
    String(правила ?? settings.musicPrompt ?? '').trim() || ПРАВИЛА_МУЗЫКИ,
    ещё
      ? `- tracks: ${сколько + 2} NEW songs for ${владелец}'s existing playlist "${название}" — keep its mood and idea, never repeat a track that is already in it (listed in the user message).`
      : `- tracks: ${сколько + 2} songs ${владелец} would keep in one playlist on their own phone — their personal taste by age, background, personality, current life and state, not a film score. Songs with vocals are fine. One playlist, one idea or mood.`,
    !ещё && `- name: the playlist's name as ${владелец} would title it in their phone — 1-5 words in ${язык}, personal, can be ironic or private; no emoji.`,
    тема && '- The playlist is about: ' + обрезать(тема, 120) + ' — top priority.',
    сцена && сцена.эра === 'medieval' ? '- Setting: medieval — still pick real recordings, but ones that fit how this person would sound.' : '- Setting: modern (take the year from the date if given): songs released by then.',
    правилоЯзыка(языкПесни, { сцена: false }),
    ...вкус.map(с => '- ' + с),
  ].filter(Boolean).join('\n');
  const строки = [];
  if (сцена && сцена.дата) строки.push('Date: ' + сцена.дата);
  if (сцена && сцена.место) строки.push('Scene place: ' + сцена.место);
  const сообщения = контекст && Array.isArray(контекст.сообщения) ? контекст.сообщения : [];
  let история = '';
  if (сообщения.length) {
    let всего = 0;
    const взято = [];
    for (let k = сообщения.length - 1; k >= 0; k--) {
      const с = сообщения[k];
      const строка = '[' + с.name + ']: ' + обрезать(с.text, ПРЕДЕЛ_СООБЩЕНИЯ);
      if (всего + строка.length > ПРЕДЕЛ_ИСТОРИИ && взято.length) break;
      всего += строка.length;
      взято.unshift(строка);
    }
    история = '\nRECENT STORY (oldest first):\n' + взято.join('\n\n');
  }
  const user = ['<reference>', 'PHONE OWNER: ' + владелец, о, ...строки,
    ...блокКонтекста(контекст).map(б => '\n' + б),
    история,
    '</reference>',
    ещё ? '\nALREADY IN THE PLAYLIST "' + название + '" (never repeat): ' + уже.map(т => т.a + ' — ' + т.t).join('; ') : '',
    '\nTASK: ' + (ещё ? 'add new songs to this playlist.' : 'make one playlist for ' + владелец + "'s phone and name it.") + ' Do not continue the story, do not write prose. Answer with ONLY the JSON object described in the instructions — start with "{" and end with "}".'].filter(Boolean).join('\n');
  return { system, user };
}

// Последний ход с HUD — оттуда возраст, роль, мысли владельца.
function последнийHUD(chat, до) {
  for (let k = Math.min(до, chat.length - 1); k >= 0 && k >= до - 40; k--) {
    const m = chat[k];
    if (!m || m.is_user) continue;
    const d = данныеHUD(m);
    if (d) return d;
  }
  return null;
}

/**
 * Новый плейлист владельца телефона или «Ещё» в существующий (id).
 * Контекст — на сейчас: последние сообщения чата, а не момент хода.
 */
export async function создатьПлейлист(индекс, владелецСырой, { id = null } = {}) {
  const владелец = ключВладельца(владелецСырой);
  const ctx = контекст();
  const chat = ctx && Array.isArray(ctx.chat) ? ctx.chat : null;
  if (!владелец || !chat || !chat.length || идутПлейлисты.has(владелец)) return;
  const б = библиотека(ctx.chatMetadata, true);
  if (!б) return;
  const з = записьВладельца(б, владелец, true);
  const пл = id ? з.playlists.find(п => п && п.id === id) : null;
  if (id && !пл) return;
  const тема = пл ? (пл.theme || '') : String(темыПлейлистов.get(владелец) || '').trim();
  const отмена = new AbortController();
  идутПлейлисты.set(владелец, { отмена, что: пл ? 'more' : 'new', id });
  ошибкиПлейлистов.delete(владелец);
  обновитьТелефоны(владелец);
  try {
    const последний = chat.length - 1;
    const data = последнийHUD(chat, Number.isInteger(Number(индекс)) ? Math.max(Number(индекс), последний) : последний);
    const справка = await собратьКонтекстМузыки(ctx, chat, последний);
    const сколько = пл ? 5 : числоТреков();
    const { system, user } = промптПлейлиста({ владелец, о: оВладельцеПодробно(data, владелец), сцена: data ? сценаИзHUD(data) : null, контекст: справка, тема,
      уже: пл ? пл.tracks : [], сколько, название: пл ? пл.name : '',
      вкус: строкиВкуса({ лайки: з.liked, запреты: запретыИгрока(), чьи: владелец }), языкПесни: языкПесен(settings) });
    const raw = await спросить(ctx, system, user, отмена);
    const ответ = разобратьПлейлист(raw);
    let треки = безЗапрещённых(ответ.tracks, запретыИгрока()).filter(т => !вСписке(пл ? пл.tracks : [], т));
    if (!треки.length) throw new Error(пл ? 'модель прислала только то, что уже есть' : 'модель не прислала треков');
    if (settings.musicVerify !== false) треки = await сверить(треки, отмена.signal);
    треки = отобрать(треки, сколько);
    // Пока ждали, чат могли сменить — библиотека уже другая.
    const сейчас = контекст();
    if (!сейчас || сейчас.chatMetadata !== ctx.chatMetadata) return;
    let открыть = пл;
    if (пл) {
      const n = дописатьПлейлист(пл, треки, chat.length);
      показать('success', 'Музыка', n ? 'В «' + пл.name + '» добавлено треков: ' + n : 'Новых треков не нашлось — всё уже есть в плейлисте.');
    } else {
      открыть = новыйПлейлист(з, { name: ответ.name || (английский() ? 'Playlist ' : 'Плейлист ') + (з.playlists.length + 1), tracks: треки, theme: тема, mes: chat.length });
      темыПлейлистов.delete(владелец);
    }
    сохранитьМетаданные(ctx);
    видыТелефона.set(Number(индекс) + '|' + владелец, { вид: 'list', id: открыть.id });
  } catch (e) {
    if (!отмена.signal.aborted) {
      console.warn('[TavernOS HUD] плейлист не собрался:', e);
      ошибкиПлейлистов.set(владелец, e && e.message ? e.message : String(e));
    }
  } finally {
    идутПлейлисты.delete(владелец);
    обновитьТелефоны(владелец);
  }
}

// «Нравится» в телефоне — вкус владельца, отдельно от вашего.
function лайкТелефона(владелец, т) {
  const ctx = контекст();
  const з = записьВладельца(библиотека(ctx && ctx.chatMetadata, true), владелец, true);
  if (!з || !т) return;
  const р = переключить(з.liked, т, ПРЕДЕЛ_ЛАЙКОВ);
  з.liked = р.список;
  сохранитьМетаданные(ctx);
  обновитьТелефоны(владелец);
}

function удалитьПлейлистВладельца(индекс, владелец, id) {
  const ctx = контекст();
  const з = записьВладельца(библиотека(ctx && ctx.chatMetadata), владелец);
  if (!з) return;
  const п = з.playlists.find(x => x && x.id === id);
  if (игра.g === 'pl:' + id) остановитьИгру();
  if (!удалитьПлейлист(з, id)) return;
  сохранитьМетаданные(ctx);
  видыТелефона.set(Number(индекс) + '|' + владелец, { вид: 'lists' });
  показать('info', 'Музыка', 'Плейлист «' + (п ? п.name : '') + '» удалён.');
  обновитьТелефоны(владелец);
}

// Обложка плейлиста — мозаика из четырёх обложек его треков.
function мозаика(треки, класс = 'hud-mphone-plcov') {
  const арт = (треки || []).map(т => т && т.art).filter(Boolean).slice(0, 4);
  if (!арт.length) return `<span class="${класс} is-blank">${ико('list')}</span>`;
  const ячейки = арт.length < 4 ? [арт[0]] : арт;
  return `<span class="${класс}${ячейки.length === 4 ? ' is-grid' : ''}">${ячейки.map(u => `<img src="${escapeHtml(u)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`).join('')}</span>`;
}

// Строка трека телефона: обложка с ▶, название, ♡ владельца, ссылки.
function строкаТелефона(тр, k, группа, лайк) {
  return `<li class="${тр.ok === false ? 'is-unfound' : ''}${лайк ? ' is-liked' : ''}"><span class="hud-mphone-art">`
    + (тр.art ? `<img src="${escapeHtml(тр.art)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : `<span class="hud-mphone-mini">${ико('note')}</span>`)
    + кнопкаИгры(группа, k, тр, 'hud-music-artplay') + '</span>'
    + `<span class="hud-mphone-tt"><b>${escapeHtml(тр.t)}</b><em>${escapeHtml(тр.a)}</em></span>`
    + `<span class="hud-mphone-go">${кнопкаЛайка(тр, группа, k, лайк, 'plike')}${ссылкиТрека(тр)}<button type="button" class="hud-music-mt" data-mu="queue" data-g="${группа}" data-i="${k}" title="Отдать в очередь MoodTube">${ико('queue')}</button></span></li>`;
}

const сЧисломТреков = (n) => сЧислом(n, ['трек', 'трека', 'треков']);

/** Экран приложения «Музыка»: недавнее, плейлисты с названиями, «Нравится».
 *  занято, библиотека и вид — подмена состояния для стенда (tests/tools). */
export function приложениеМузыки(индекс, владелец = '', { chat = null, занято: занятоСтенд = null, библиотека: либСтенд = null, вид: видСтенд = null, плейлист: идётСтенд = null } = {}) {
  const i = Number(индекс);
  if (!Number.isInteger(i)) return '';
  const список = chat || (контекст() || {}).chat || [];
  const message = список[i];
  const занято = занятоСтенд ? { части: занятоСтенд } : message ? идут.get(ключХода(контекст(), i, message)) : null;
  const ошибка = message ? ошибки.get(ключХода(контекст(), i, message)) : '';
  const т = музыкаТелефона(i, список);
  const кто = ключВладельца(владелец || (т && т.owner) || '');
  const ктоHtml = escapeHtml(кто);
  const б = либСтенд || библиотекаЧата();
  const з = записьВладельца(б, кто);
  const плейлисты = з ? з.playlists : [];
  const лайки = з ? з.liked : [];
  const идёт = идётСтенд || идутПлейлисты.get(кто);
  const ошибкаПлейлиста = ошибкиПлейлистов.get(кто);
  const сохранённый = видСтенд || видыТелефона.get(i + '|' + кто) || {};
  let вид = сохранённый.вид || (т || !плейлисты.length ? 'recent' : 'lists');
  const открытый = вид === 'list' ? плейлисты.find(п => п.id === сохранённый.id) : null;
  if (вид === 'list' && !открытый) вид = 'lists';

  const вкладка = (v, подпись, n) => `<button type="button" role="tab" class="hud-mphone-tab${вид === v || (v === 'lists' && вид === 'list') ? ' is-on' : ''}" aria-selected="${вид === v || (v === 'lists' && вид === 'list')}" data-mu="mview" data-v="${v}">${подпись}${n ? `<i>${n}</i>` : ''}</button>`;
  const вкладки = `<div class="hud-mphone-tabs" role="tablist" aria-label="Музыка">${вкладка('recent', 'Недавно')}${вкладка('lists', 'Плейлисты', плейлисты.length)}${вкладка('liked', 'Нравится', лайки.length)}</div>`;
  const обёртка = (html) => `<div class="hud-mphone${классИгры(i, true)}" data-mesid="${i}" data-owner="${ктоHtml}" data-view="${вид}">${вкладки}${html}</div>`;
  const лайкнут = (тр) => вСписке(лайки, тр);

  // --- Плейлисты ---
  if (вид === 'lists') {
    const новыйИдёт = идёт && идёт.что === 'new';
    const карточки = плейлисты.map(п => `<li><button type="button" class="hud-mphone-pl" data-mu="mview" data-v="list" data-id="${escapeHtml(п.id)}">${мозаика(п.tracks)}`
      + `<span class="hud-mphone-pltt"><b>${escapeHtml(п.name)}</b><em>${сЧисломТреков((п.tracks || []).length)}${п.theme ? ' · ' + escapeHtml(обрезать(п.theme, 40)) : ''}</em></span><span class="hud-mphone-chev">${ико('chev')}</span></button></li>`).join('');
    return обёртка(`<div class="hud-mphone-lists">`
      + (новыйИдёт ? `<div class="hud-mphone-wait"><i aria-hidden="true"></i>Собираю плейлист ${ктоHtml}…</div>` : '')
      + (ошибкаПлейлиста && !идёт ? `<p class="hud-mphone-err">Не получилось: ${escapeHtml(обрезать(ошибкаПлейлиста, 140))}</p>` : '')
      + `<div class="hud-mphone-new"><input type="text" maxlength="120" data-mu-set="pltheme" value="${escapeHtml(темыПлейлистов.get(кто) || '')}" placeholder="Тема — по желанию" aria-label="Тема плейлиста"${идёт ? ' disabled' : ''}>`
      + `<button type="button" class="hud-mphone-get" data-mu="pl-new" title="Отдельный запрос к модели: плейлист ${ктоHtml} с названием — по карточке, лорбукам и последним сообщениям"${идёт ? ' disabled' : ''}>${ико('plus')}Создать плейлист</button></div>`
      + (карточки ? `<ul class="hud-mphone-pls">${карточки}</ul>` : `<p class="hud-mphone-hintline">Здесь соберутся плейлисты ${ктоHtml}: название и треки модель придумает по его карточке, лорбукам и последним сообщениям${лайки.length ? ', а ещё по тому, что вы отметили «Нравится»' : ''}.</p>`)
      + `</div>`);
  }

  // --- Открытый плейлист ---
  if (вид === 'list') {
    const п = открытый;
    const группа = 'pl:' + п.id;
    const ещёИдёт = идёт && идёт.что === 'more' && идёт.id === п.id;
    const новых = Math.max(0, список.length - (Number(п.mes) || список.length));
    const удалить = сохранённый.удалить === п.id;
    return обёртка(`<div class="hud-mphone-plhead"><button type="button" class="hud-mphone-back" data-mu="mview" data-v="lists" aria-label="К плейлистам">${ико('back')}</button>${мозаика(п.tracks, 'hud-mphone-plcov is-big')}`
      + `<span class="hud-mphone-pltt"><small>Плейлист</small><b>${escapeHtml(п.name)}</b><em>${сЧисломТреков(п.tracks.length)}${п.theme ? ' · ' + escapeHtml(обрезать(п.theme, 60)) : ''}</em></span></div>`
      + `<ol class="hud-mphone-list">${п.tracks.map((тр, k) => строкаТелефона(тр, k, группа, лайкнут(тр))).join('')}</ol>`
      + (ошибкаПлейлиста && !идёт ? `<p class="hud-mphone-err">Не получилось: ${escapeHtml(обрезать(ошибкаПлейлиста, 140))}</p>` : '')
      + `<div class="hud-mphone-foot hud-mphone-plfoot">`
      + (ещёИдёт ? `<div class="hud-mphone-wait"><i aria-hidden="true"></i>Дописываю…</div>`
        : `<button type="button" class="hud-mphone-get" data-mu="pl-more" data-id="${escapeHtml(п.id)}" title="Ещё треков в этот плейлист — без повторов${новых ? '; с прошлого раза в чате ' + сЧислом(новых, ['новое сообщение', 'новых сообщения', 'новых сообщений']) : ''}"${идёт ? ' disabled' : ''}>${ико('plus')}Ещё${новых ? `<i class="hud-mphone-new-badge">+${сЧислом(новых, ['сообщение', 'сообщения', 'сообщений'])}</i>` : ''}</button>`)
      + (удалить
        ? `<span class="hud-mphone-confirm">Удалить «${escapeHtml(обрезать(п.name, 24))}»?<button type="button" class="hud-mphone-del is-yes" data-mu="pl-del-yes" data-id="${escapeHtml(п.id)}">Удалить</button><button type="button" class="hud-mphone-del" data-mu="pl-del-no">Нет</button></span>`
        : `<button type="button" class="hud-mphone-del" data-mu="pl-del" data-id="${escapeHtml(п.id)}" title="Удалить плейлист" aria-label="Удалить плейлист">${ико('trash')}</button>`)
      + `</div>`);
  }

  // --- Нравится ---
  if (вид === 'liked') {
    const группа = 'pf:' + (з ? з.id : '');
    return обёртка(лайки.length
      ? `<p class="hud-mphone-hintline">То, что вы отметили у ${ктоHtml}. Его новые плейлисты и музыка в телефоне будут ближе к этому.</p><ol class="hud-mphone-list">${лайки.map((тр, k) => строкаТелефона(тр, k, группа, true)).join('')}</ol>`
      : `<div class="hud-mphone-empty"><span class="hud-mphone-disc" aria-hidden="true"></span><p>Отмечайте ${ико('heart')} треки в телефоне ${ктоHtml} — его новые плейлисты будут ближе к ним.</p></div>`);
  }

  // --- Недавно: что слушает сейчас (подбирается вместе с музыкой сцены) ---
  const кнопка = (подпись) => `<button type="button" class="hud-mphone-get" data-mu="part" data-part="phone"${занято ? ' disabled' : ''}>${ико('note')}${подпись}</button>`;
  if (занято && занято.части.includes('phone')) return обёртка('<div class="hud-mphone-wait"><i aria-hidden="true"></i>Подбираю, что слушает ' + ктоHtml + '…</div>');
  if (!т) {
    return обёртка(`<div class="hud-mphone-empty"><span class="hud-mphone-disc" aria-hidden="true"></span><p>${ошибка ? 'Не получилось: ' + escapeHtml(обрезать(ошибка, 120)) : 'Здесь будет то, что слушает ' + ктоHtml + ' — по его вкусу, возрасту и настроению.'}</p>${кнопка('Подобрать музыку')}</div>`);
  }
  // Наверху — играющий трек; ничего не играет — последний прослушанный.
  // Номера (data-i) остаются номерами в библиотеке.
  const играетЗдесь = игра.mesid === i && игра.g === 'p' && т.tracks[игра.i] ? игра.i : -1;
  const n0 = играетЗдесь >= 0 ? играетЗдесь : 0;
  const первый = т.tracks[n0];
  const остальные = т.tracks.map((тр, k) => [тр, k]).filter(([, k]) => k !== n0);
  const обложкаБольшая = первый.art ? `<img src="${escapeHtml(первый.art)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : `<span class="is-blank">${ико('note')}</span>`;
  return обёртка(`<div class="hud-mphone-now">`
    + `<div class="hud-mphone-cover">${обложкаБольшая}${кнопкаИгры('p', n0, первый, 'hud-mphone-bigplay')}</div>`
    + `<small>${играетЗдесь >= 0 ? 'Сейчас играет' : 'Последнее, что слушал(а) ' + ктоHtml}</small><b>${escapeHtml(первый.t)}</b><em>${escapeHtml(первый.a)}</em>`
    + `<div class="hud-mphone-bar" aria-hidden="true"><i></i></div>${плеерВключён() ? `<small class="hud-mphone-hint">${settings.musicSource === 'youtube' ? 'Полные треки с YouTube через зеркала' : settings.musicSource === 'full' ? 'Полные треки через неофициальный сервис' : черезMoodTube() ? 'Целиком — в MoodTube' : 'Отрывки по 30 секунд; целиком — по ссылке'}</small>` : ''}`
    + `<div class="hud-mphone-go">${кнопкаЛайка(первый, 'p', n0, лайкнут(первый), 'plike')}${ссылкиТрека(первый)}<button type="button" class="hud-music-mt" data-mu="queue" data-g="p" data-i="${n0}" title="Отдать в очередь MoodTube">${ико('queue')}</button></div></div>`
    + (остальные.length ? `<div class="hud-mphone-sec">Недавно</div><ol class="hud-mphone-list">${остальные.map(([тр, k]) => строкаТелефона(тр, k, 'p', лайкнут(тр))).join('')}</ol>` : '')
    + `<div class="hud-mphone-foot">${т.i !== i ? `<small>библиотека с хода ${т.i + 1}</small>` : ''}${кнопка('Обновить')}</div>`);
}

/** Все полосы в ленте заново: включили/выключили музыку, сменили вид. */
export function обновитьВсеПолосы() {
  document.querySelectorAll('#chat .mes[mesid]').forEach(mes => { if (mes.querySelector('.hud-os-card')) обновитьПолосу(mes.getAttribute('mesid')); });
}

// Пустые полосы «Подобрать» у прежних ходов — прочь, когда пришёл новый.
function убратьСтарыеПустые() {
  const ctx = контекст();
  const последний = ctx && Array.isArray(ctx.chat) ? ctx.chat.length - 1 : -1;
  document.querySelectorAll('#chat .hud-music.is-empty:not(.is-error)').forEach(п => { if (Number(п.dataset.mesid) !== последний) п.remove(); });
}

// ---------------------------------------------------------------------------
// ПЛАВАЮЩИЙ ЗНАЧОК: что играет, когда карточка уехала из виду
// ---------------------------------------------------------------------------
// Крошечный полупрозрачный кружок у правого края над полем ввода. Виден,
// только пока звук идёт или стоит на паузе, а полоса (или экран телефона) с
// ним ушли за край ленты — тексту он не мешает. Нажатие раскрывает строку:
// название, пауза, «к карточке», стоп; через пять секунд без нажатий она
// сворачивается обратно. Настройка musicFloat.
let значок = null, наблюдатель = null, наблюдаем = null, видна = false, свернуть = 0;

function элементИгры() {
  if (игра.mesid === null || typeof document === 'undefined') return null;
  return document.querySelector(`#chat .mes[mesid="${игра.mesid}"] ${этоТелефон(игра.g) ? '.hud-mphone' : '.hud-music'}`);
}
const звукЕсть = () => игра.mesid !== null && !!(игра.audio && игра.audio.getAttribute('src'));

function раскрытьЗначок(да) {
  if (!значок) return;
  значок.classList.toggle('is-open', да);
  const кнопка = значок.querySelector('.hud-mf-dot');
  if (кнопка) кнопка.setAttribute('aria-expanded', String(да));
  clearTimeout(свернуть);
  if (да) свернуть = setTimeout(() => раскрытьЗначок(false), 5000);
}

function создатьЗначок() {
  if (значок || typeof document === 'undefined' || !document.body) return значок;
  значок = document.createElement('div');
  значок.className = 'hud-music-float';
  значок.hidden = true;
  значок.innerHTML = `<button type="button" class="hud-mf-dot" data-mf="open" aria-expanded="false" aria-label="Музыка: что играет" title="Что играет"><i></i><i></i><i></i></button>`
    + `<div class="hud-mf-panel"><span class="hud-mf-tt"><b></b><em></em></span>`
    + `<button type="button" class="hud-mf-btn hud-mf-play" data-mf="play" aria-label="Пауза или продолжить">${ИГРА}</button>`
    + `<button type="button" class="hud-mf-btn" data-mf="go" aria-label="К карточке" title="К карточке">${ико('up')}</button>`
    + `<button type="button" class="hud-mf-btn" data-mf="stop" aria-label="Остановить" title="Остановить">${ико('close')}</button></div>`;
  значок.addEventListener('click', (e) => {
    const б = e.target.closest && e.target.closest('[data-mf]');
    if (!б) return;
    e.preventDefault();
    e.stopPropagation();
    const д = б.dataset.mf;
    if (д === 'open') раскрытьЗначок(!значок.classList.contains('is-open'));
    else if (д === 'play') {
      const a = игра.audio;
      if (a && a.getAttribute('src')) { if (a.paused) a.play().catch(() => {}); else a.pause(); }
      раскрытьЗначок(true);
    } else if (д === 'go') {
      const эл = элементИгры();
      if (эл) эл.scrollIntoView({ block: 'center', behavior: 'smooth' });
      раскрытьЗначок(false);
    } else if (д === 'stop') { раскрытьЗначок(false); остановитьИгру(); }
  });
  document.body.appendChild(значок);
  return значок;
}

function показатьЗначок() {
  if (!значок) return;
  значок.hidden = !звукЕсть() || (видна && !!наблюдаем);
  if (значок.hidden) раскрытьЗначок(false);
}

/** Значок под текущую игру: что играет, где карточка, виден ли. */
export function обновитьЗначок() {
  if (!звукЕсть() || !settings.enableMusic || settings.musicFloat === false) {
    if (значок) { значок.hidden = true; раскрытьЗначок(false); }
    if (наблюдатель) наблюдатель.disconnect();
    наблюдаем = null;
    return;
  }
  if (!создатьЗначок()) return;
  // Полосу перерисовывают целиком — следим за свежим элементом.
  const эл = элементИгры();
  if (эл !== наблюдаем) {
    if (!наблюдатель && typeof IntersectionObserver === 'function') {
      наблюдатель = new IntersectionObserver((записи) => { for (const з of записи) if (з.target === наблюдаем) видна = з.isIntersecting; показатьЗначок(); });
    }
    if (наблюдатель) { наблюдатель.disconnect(); if (эл) наблюдатель.observe(эл); }
    наблюдаем = эл;
    видна = !!эл && !наблюдатель;
  }
  const т = игра.трек || трекиГруппы(игра.mesid, игра.g)[игра.i] || null;
  const b = значок.querySelector('.hud-mf-tt b'), em = значок.querySelector('.hud-mf-tt em');
  if (b) b.textContent = т ? (т.поток ? т.a : т.t) : '';
  if (em) em.textContent = т ? (т.поток ? (т.жанры || 'Радио') : т.a) : '';
  значок.classList.toggle('is-playing', !!игра.играет);
  значок.classList.toggle('is-loading', !!игра.грузится);
  показатьЗначок();
}

// ---------------------------------------------------------------------------
// MoodTube и строка для модели
// ---------------------------------------------------------------------------

const moodTube = () => { const api = window.MoodTubeAPI; return api && typeof api.enqueueMany === 'function' ? api : null; };
function отметитьMoodTube() { document.documentElement.classList.toggle('hud-has-moodtube', !!moodTube()); }

// MoodTube сам сообщает модели свой трек — вторая строка о музыке спорила бы с ней.
function moodTubeГоворит() {
  try { return localStorage.getItem('moodtube_music_context') === 'true' && !!(moodTube() && moodTube().isPlaying && moodTube().isPlaying()); } catch (_) { return false; }
}

/** Строка «в сцене играет…» для модели — по последней подборке чата. */
export function обновитьСтрокуСцены() {
  const ctx = контекст();
  if (!ctx || typeof ctx.setExtensionPrompt !== 'function') return;
  let текст = '';
  if (settings.enableMusic && settings.musicSceneLine) {
    const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
    for (let i = chat.length - 1; i >= 0 && i >= chat.length - 30; i--) {
      const м = музыкаХода(chat[i]);
      if (!м) continue;
      const т = м.scene && м.scene.tracks && м.scene.tracks[0];
      if (т) текст = `[Music playing in the scene${м.scene.src ? ' (' + м.scene.src + ')' : ''}: "${т.a} — ${т.t}". Characters can hear it and may react to it if it fits the moment.]`;
      break;
    }
    if (текст && moodTubeГоворит()) текст = '';
  }
  const типы = ctx.extension_prompt_types || {}, роли = ctx.extension_prompt_roles || {};
  try { ctx.setExtensionPrompt(КЛЮЧ_ПРОМПТА, текст, типы.IN_CHAT ?? 1, 1, false, роли.SYSTEM ?? 0); } catch (e) { console.warn('[TavernOS HUD] музыка: строка для модели', e); }
}

// ---------------------------------------------------------------------------
// НАЖАТИЯ (зовёт events.js) и события Таверны
// ---------------------------------------------------------------------------

const показать = (тип, заголовок, текст) => { try { основа && основа.showHudToast && основа.showHudToast(тип, заголовок, текст); } catch (_) { /* без тоста */ } };

function поставитьСейчас(индекс, группа, i) {
  const ctx = контекст();
  const message = ctx && ctx.chat && ctx.chat[индекс];
  const м = музыкаХода(message);
  if (!м) return;
  // Только в памяти: сохранять файл чата (десятки мегабайт) ради указателя
  // «сейчас играет» — дорого. Таверна сохранит его вместе со следующим ходом.
  сохранитьМузыку(message, { ...м, now: [группа === 'c' ? 'c' : 's', i] });
  обновитьПолосу(индекс);
}

// «Нравится» / «не предлагать» в полосе сцены — ваш вкус, в настройках.
// Одно исключает другое: понравившееся не бывает запрещённым.
function отметитьВкус(индекс, группа, i, что) {
  const т = трекиГруппы(индекс, группа)[i];
  if (!т) return;
  if (что === 'like') {
    const р = переключить(лайкиИгрока(), т, ПРЕДЕЛ_ЛАЙКОВ);
    settings.musicLiked = р.список;
    if (р.есть && вСписке(запретыИгрока(), т)) settings.musicBanned = переключить(запретыИгрока(), т, ПРЕДЕЛ_ЗАПРЕТОВ).список;
  } else {
    const р = переключить(запретыИгрока(), т, ПРЕДЕЛ_ЗАПРЕТОВ);
    settings.musicBanned = р.список;
    if (р.есть) {
      if (вСписке(лайкиИгрока(), т)) settings.musicLiked = переключить(лайкиИгрока(), т, ПРЕДЕЛ_ЛАЙКОВ).список;
      показать('info', 'Музыка', 'Больше не предложу: ' + т.a + ' — ' + т.t);
      // Играет как раз он — дальше.
      if (игра.mesid === Number(индекс) && игра.g === группа && игра.i === i) следующий(1, true);
    }
  }
  if (основа && typeof основа.saveSettings === 'function') основа.saveSettings();
  обновитьВсеПолосы();
}

function вОчередь(индекс, группа, i) {
  const api = moodTube();
  if (!api) { показать('info', 'MoodTube', 'MoodTube не найден — поставьте расширение или откройте трек по ссылке.'); return; }
  const ctx = контекст();
  const м = музыкаХода(ctx && ctx.chat && ctx.chat[индекс]);
  if (!м) return;
  const телефон = группа === 'p' ? музыкаТелефона(индекс) : null;
  const треки = группа === 'all' ? (м.soundtrack || []).filter(т => т.ok !== false)
    : [((группа === 'p' ? телефон && телефон.tracks : группа === 'c' ? м.scene && м.scene.tracks : м.soundtrack) || [])[i]].filter(Boolean);
  if (!треки.length) return;
  try {
    api.enqueueMany(треки.map(т => т.a + ' - ' + т.t));
    показать('success', 'MoodTube', треки.length === 1 ? 'В очереди: ' + треки[0].a + ' — ' + треки[0].t : 'В очередь ушло ' + сЧислом(треки.length, ['трек', 'трека', 'треков']));
  } catch (e) { показать('error', 'MoodTube', 'Не принял очередь: ' + (e && e.message || e)); }
}

/** Нажатие в полосе музыки. true — обработано, дальше не передавать. */
export function действиеМузыки(e) {
  const t = e.target && e.target.closest ? e.target : null;
  const полоса = t && t.closest('.hud-music, .hud-mphone');
  if (!полоса) return false;
  if (t.closest('a')) return e.type === 'keydown' ? false : true;
  if (t.closest('.hud-music-vol')) return true;
  if (t.closest('input[data-mu-set="wish"]')) { if (e.type === 'keydown' && e.key === 'Enter') { e.preventDefault(); t.blur(); } return true; }
  // Тема нового плейлиста: Enter — создать.
  if (t.closest('input[data-mu-set="pltheme"]')) {
    if (e.type === 'keydown' && e.key === 'Enter') { e.preventDefault(); создатьПлейлист(Number(полоса.dataset.mesid), полоса.dataset.owner || ''); }
    return true;
  }
  const эл = t.closest('[data-mu]');
  if (!эл || !полоса.contains(эл)) return true;
  // Enter на настоящей кнопке браузер сам превращает в click.
  if (e.type === 'keydown' && эл.tagName === 'BUTTON') return true;
  if (e.type === 'keydown') e.preventDefault();
  const индекс = Number(полоса.dataset.mesid);
  const д = эл.dataset.mu;
  if (д === 'open') {
    const открыта = полоса.classList.toggle('is-open');
    полоса.classList.toggle('fx-active', открыта);
    if (открыта) прогреть(индекс);
    эл.setAttribute('aria-expanded', String(открыта));
  } else if (д === 'pick' || д === 'redo') подобратьМузыку(индекс, { вручную: true });
  else if (д === 'part') подобратьМузыку(индекс, { вручную: true, части: [эл.dataset.part] });
  else if (д === 'play') { if (эл.dataset.g === 'r') играйРадио(индекс, 0); else if (эл.dataset.g === 'f') играйФон(индекс, 0); else играть(индекс, эл.dataset.g, Number(эл.dataset.i)); }
  else if (д === 'free-next') играйФон(индекс, игра.mesid === индекс && игра.g === 'f' ? 1 : 0);
  else if (д === 'radio-next') играйРадио(индекс, 1);
  else if (д === 'meme') { const м = музыкаХода((контекст() || {}).chat?.[индекс]); подобратьМузыку(индекс, { вручную: true, части: ['soundtrack'], мемы: !(м && м.meme) }); }
  else if (д === 'like' || д === 'ban') отметитьВкус(индекс, эл.dataset.g, Number(эл.dataset.i), д);
  else if (д === 'plike') { const т = трекиГруппы(индекс, эл.dataset.g)[Number(эл.dataset.i)]; лайкТелефона(ключВладельца(полоса.dataset.owner), т); }
  else if (д === 'mview') {
    const кто = ключВладельца(полоса.dataset.owner);
    видыТелефона.set(индекс + '|' + кто, { вид: эл.dataset.v, id: эл.dataset.id || '' });
    обновитьТелефоны(кто);
  }
  else if (д === 'pl-new') создатьПлейлист(индекс, полоса.dataset.owner || '');
  else if (д === 'pl-more') создатьПлейлист(индекс, полоса.dataset.owner || '', { id: эл.dataset.id });
  else if (д === 'pl-del' || д === 'pl-del-no') {
    const кто = ключВладельца(полоса.dataset.owner);
    const был = видыТелефона.get(индекс + '|' + кто) || {};
    видыТелефона.set(индекс + '|' + кто, { ...был, удалить: д === 'pl-del' ? эл.dataset.id : '' });
    обновитьТелефоны(кто);
  }
  else if (д === 'pl-del-yes') удалитьПлейлистВладельца(индекс, ключВладельца(полоса.dataset.owner), эл.dataset.id);
  else if (д === 'count') сменитьЧислоТреков(Number(эл.dataset.d) || 0);
  else if (д === 'wish-clear') поставитьПожелание('', true);
  else if (д === 'cancel') отменить(индекс);
  else if (д === 'now') поставитьСейчас(индекс, эл.dataset.g, Number(эл.dataset.i));
  else if (д === 'queue') вОчередь(индекс, эл.dataset.g, Number(эл.dataset.i));
  else if (д === 'queue-all') вОчередь(индекс, 'all', 0);
  return true;
}

// Новый ход: подборка по смене сцены. Ждём немного — HUD может дописаться
// позже (перегенерация, «Создать HUD»): тогда придёт MESSAGE_UPDATED.
function проверитьХод(id) {
  const индекс = Number(id);
  убратьСтарыеПустые();
  if (!settings.enableMusic) return;
  const ctx = контекст();
  const chat = ctx && Array.isArray(ctx.chat) ? ctx.chat : [];
  if (индекс !== chat.length - 1) return;
  const message = chat[индекс];
  if (!message || message.is_user || message.is_system) return;
  const когда = свежие.get(индекс);
  if (settings.musicAuto === false || !когда || Date.now() - когда > СВЕЖЕСТЬ_МС) { обновитьПолосу(индекс); return; }
  if (музыкаХода(message) || идут.has(ключХода(ctx, индекс, message)) || ошибки.has(ключХода(ctx, индекс, message))) return;
  if (!данныеHUD(message)) { обновитьПолосу(индекс); return; }
  подобратьМузыку(индекс);
}

export function подключитьМузыку(связь) {
  основа = связь || основа;
  if (подключено) return;
  подключено = true;
  window.addEventListener('moodtube:ready', отметитьMoodTube);
  отметитьMoodTube();
  for (const [событие, сохранить] of [['input', false], ['change', true]]) {
    document.addEventListener(событие, (e) => {
      const п = e.target && e.target.closest && e.target.closest('.hud-music input[data-mu-set="volume"]');
      if (п) поставитьГромкость(п.value, сохранить);
      const w = e.target && e.target.closest && e.target.closest('.hud-music input[data-mu-set="wish"]');
      if (w) поставитьПожелание(w.value, сохранить, w);
      const тм = e.target && e.target.closest && e.target.closest('.hud-mphone input[data-mu-set="pltheme"]');
      if (тм) { const кто = ключВладельца((тм.closest('.hud-mphone') || {}).dataset?.owner); if (кто) темыПлейлистов.set(кто, тм.value.slice(0, 120)); }
    });
  }
  const ctx = контекст();
  const es = ctx && ctx.eventSource, et = ctx && ctx.event_types;
  if (!es || !et) return;
  const позже = (f, мс) => (...a) => setTimeout(() => { try { f(...a); } catch (e) { console.warn('[TavernOS HUD] музыка:', e); } }, мс);
  if (et.MESSAGE_RECEIVED) es.on(et.MESSAGE_RECEIVED, (id) => { свежие.set(Number(id), Date.now()); позже(проверитьХод, 1500)(id); });
  if (et.MESSAGE_UPDATED) es.on(et.MESSAGE_UPDATED, позже(проверитьХод, 900));
  if (et.MESSAGE_SWIPED) es.on(et.MESSAGE_SWIPED, позже(обновитьСтрокуСцены, 300));
  if (et.MESSAGE_DELETED) es.on(et.MESSAGE_DELETED, позже(обновитьСтрокуСцены, 300));
  // Станции и фон — по номерам сообщений: в другом чате они чужие.
  if (et.CHAT_CHANGED) es.on(et.CHAT_CHANGED, позже(() => { свежие.clear(); ошибки.clear(); радиоХода.clear(); фонХода.clear(); остановитьИгру(); обновитьСтрокуСцены(); }, 300));
  обновитьСтрокуСцены();
}
