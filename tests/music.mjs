// hud-manager/tests/music.mjs
//
// Музыка сцены: вкус («нравится» / «не предлагать»), язык песен, мемы,
// радио в сцене, плейлисты телефона с названиями, «Ещё» без повторов.
// Модель подставная, сеть — заглушка: node tests/music.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/') + '/';
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const узел = () => { let t = ''; return { style: { setProperty() {}, removeProperty() {}, getPropertyValue: () => '' }, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, set innerHTML(x) { t = String(x); }, get innerHTML() { return t; }, set textContent(x) { t = String(x); }, get textContent() { return t; }, get value() { return t; }, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, setAttribute() {}, getAttribute: () => null, addEventListener() {} }; };
globalThis.document = { createElement: узел, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, documentElement: узел(), body: null, addEventListener() {} };
console.info = () => {}; console.warn = () => {}; console.debug = () => {};
const v = JSON.parse(fs.readFileSync(ROOT + 'manifest.json', 'utf8')).version;
const м = (f) => import('file:///' + ROOT + f + '?v=' + v);
let проб = 0, провалов = 0;
const проверить = (что, ок, подр = '') => { проб++; if (!ок) { провалов++; console.log('✗', что, String(подр).slice(0, 500)); } else console.log('✓', что); };

const { settings } = await м('settings.js');
const L = await м('render/music-lib.js');
const R = await м('render/music-radio.js');
const M = await м('render/music.js');
const D = await м('render/music-data.js');

// --- Вкус ---------------------------------------------------------------------------
const т = (a, t2, доп = {}) => ({ a, t: t2, ...доп });
let р = L.переключить([], т('The Beatles', 'Help! (Remastered 2009)', { art: 'x', url: 'u', pv: 'p' }), 3);
проверить('нравится: добавляется кратко — без ссылок и отрывков', р.есть && р.список.length === 1 && !('url' in р.список[0]) && !('pv' in р.список[0]) && р.список[0].art === 'x');
проверить('нравится: тот же трек в другом написании — тот же', L.вСписке(р.список, т('Beatles', 'Help!')));
р = L.переключить(р.список, т('beatles', 'help'), 3);
проверить('нравится: повторное нажатие убирает', !р.есть && р.список.length === 0);
let список = [];
for (const k of [1, 2, 3, 4]) список = L.переключить(список, т('A' + k, 'T'), 3).список;
проверить('нравится: свежие первыми, предел держится', список.length === 3 && список[0].a === 'A4' && !L.вСписке(список, т('A1', 'T')));
проверить('не предлагать: запрещённое убирается из ответа', L.безЗапрещённых([т('A', 'X'), т('B', 'Y')], [т('a', 'x')]).map(x => x.a).join() === 'B');
const вкусИгрока = L.строкиВкуса({ лайки: [т('A', 'X')], запреты: [т('B', 'Y')] });
проверить('вкус игрока: подсказка и запрет', вкусИгрока.length === 2 && /player liked/.test(вкусИгрока[0]) && /A — X/.test(вкусИгрока[0]) && /Never suggest/.test(вкусИгрока[1]) && /B — Y/.test(вкусИгрока[1]));
const вкусТелефона = L.строкиВкуса({ лайки: [т('C', 'Z')], чьи: 'Tristan' });
проверить('вкус телефона: это вкус владельца, а не игрока', вкусТелефона.length === 1 && /Tristan's own taste/.test(вкусТелефона[0]) && !/player liked/.test(вкусТелефона[0]));

// --- Язык и мемы ----------------------------------------------------------------------
проверить('язык песен: свой — буквы без мусора', L.языкПесен({ musicLang: 'custom', musicLangCustom: 'Ukrainian"; drop' }) === 'Ukrainian drop' && L.языкПесен({ musicLang: 'Klingon' }) === '' && L.языкПесен({ musicLang: 'Russian' }) === 'Russian');
проверить('язык песен: правило жёсткое, музыка в сцене — по месту', /every song with vocals must be sung in Russian/.test(L.правилоЯзыка('Russian')) && /Scene music: prefer Russian/.test(L.правилоЯзыка('Russian')) && !/Scene music/.test(L.правилоЯзыка('Russian', { сцена: false })) && L.правилоЯзыка('') === '');
проверить('мемы: смешная сцена — по настроению, атмосфере, повороту', L.смешнаяСцена({ настроение: 'нелепое', атмосфера: '' }) && L.смешнаяСцена({ атмосфера: 'полный абсурд' }) && !L.смешнаяСцена({ настроение: 'тревожное' }));
проверить('мемы: режимы', L.мемныйРежим('on', null) && !L.мемныйРежим('off', { настроение: 'абсурд' }) && L.мемныйРежим('auto', { настроение: 'абсурд' }) && !L.мемныйРежим('auto', { настроение: 'грусть' }));

// --- Библиотека телефона ------------------------------------------------------------------
const meta = {};
проверить('библиотека: без «создать» — не заводится', L.библиотека(meta) === null && !(L.КЛЮЧ_БИБЛИОТЕКИ in meta));
const б = L.библиотека(meta, true);
const з = L.записьВладельца(б, 'Tristan', true);
проверить('библиотека: запись владельца с id', з && з.id && Array.isArray(з.playlists) && Array.isArray(з.liked) && L.записьПоId(б, з.id).имя === 'Tristan');
const п = L.новыйПлейлист(з, { name: 'Ночная трасса', tracks: [т('A', 'X'), т('a', 'x'), т('B', 'Y')], theme: 'для дороги', mes: 10 });
проверить('плейлист: без повторов, с темой и отметкой сообщения', п.tracks.length === 2 && п.theme === 'для дороги' && п.mes === 10 && L.плейлистПоId(б, п.id).п === п);
const добавлено = L.дописатьПлейлист(п, [т('B', 'Y'), т('C', 'Z')], 14);
проверить('«Ещё»: только новые, отметка сообщения сдвигается', добавлено === 1 && п.tracks.length === 3 && п.mes === 14);
проверить('плейлист: удаляется', L.удалитьПлейлист(з, п.id) && !з.playlists.length && !L.удалитьПлейлист(з, 'нет'));

// --- Радио ----------------------------------------------------------------------------
проверить('радио: русский поп — Russian Mix первым', R.станцииРекорда('russian pop')[0].name === 'Russian Mix');
проверить('радио: медляк, шансон, 80-е, lo-fi — свои станции Рекорда', R.станцииРекорда('slow romantic')[0].name === 'Медляк FM' && R.станцииРекорда('chanson')[0].name === 'Гоп FM' && R.станцииРекорда('80s')[0].name === 'Record 80-х' && R.станцииРекорда('lo-fi')[0].name === 'Lo-Fi');
проверить('радио: джаза у Рекорда нет', R.станцииРекорда('jazz').length === 0);
проверить('радио: поток Рекорда — https на их сервере', R.станцииРекорда('rock').every(с => /^https:\/\/radiorecord\.hostingradio\.ru\/[\w.-]+$/.test(с.url)));
проверить('радио: годная станция — https на https-странице, без плейлистов m3u', R.годнаяСтанция({ url_resolved: 'https://a/b' }, true) && !R.годнаяСтанция({ url_resolved: 'http://a/b' }, true) && R.годнаяСтанция({ url_resolved: 'http://a/b' }, false) && !R.годнаяСтанция({ url_resolved: 'https://a/b.m3u8' }, false) && !R.годнаяСтанция({ url_resolved: 'https://a/b', lastcheckok: 0 }, false));
{
  const былFetch = globalThis.fetch;
  const запросы = [];
  globalThis.fetch = async (u) => { запросы.push(String(u)); return { ok: true, json: async () => [{ name: 'Smooth Jazz US', url_resolved: 'https://jazz.example/stream', tags: 'jazz,smooth', countrycode: 'US' }, { name: 'Broken', url_resolved: 'https://x/list.m3u' }] }; };
  const наш = await R.станцииСцены('russian pop', 'RU');
  const мир = await R.станцииСцены('jazz', 'US');
  globalThis.fetch = былFetch;
  проверить('радио в сцене: в России — Рекорд первым, мир про запас', наш[0].src === 'record' && наш.some(с => с.src === 'world'));
  проверить('радио в сцене: джаз в США — каталог мира по тегу и стране, битые прочь', мир[0].name === 'Smooth Jazz US' && !мир.some(с => /m3u/.test(с.url)) && запросы.some(u => /tag=jazz/.test(u) && /countrycode=US/.test(u)));
}

// --- Запрос подборки --------------------------------------------------------------------
const сцена = { эра: 'modern', дата: '01.11.24', место: 'бар', настроение: 'весёлое' };
const полный = M.промптМузыки({ сцена, части: ['soundtrack', 'scene'], вкус: вкусИгрока, языкПесни: 'Russian', мемы: true, радио: true });
проверить('запрос: радио — поле в схеме и правило', /"radio":"\.\.\."/.test(полный.system) && /"country"/.test(полный.system) && /- radio: /.test(полный.system));
проверить('запрос: мемы вместо обычного саундтрека', /MEME MODE/.test(полный.system) && !/like the soundtrack of a film/.test(полный.system));
проверить('запрос: язык и вкус', /LANGUAGE \(top priority/.test(полный.system) && /- The player liked these tracks/.test(полный.system) && /- Never suggest these/.test(полный.system));
const простой = M.промптМузыки({ сцена: { ...сцена, эра: 'medieval' }, части: ['soundtrack', 'scene'] });
проверить('запрос: без радио и мемов — как раньше', !/"radio"/.test(простой.system) && !/MEME/.test(простой.system) && !/LANGUAGE/.test(простой.system));
const сТелефоном = M.промптМузыки({ сцена, части: ['soundtrack', 'scene', 'phone'], телефон: { владелец: 'Tristan', о: '', прежние: [], вкус: вкусТелефона } });
проверить('запрос: у телефона свой вкус', /- phone: Tracks marked as liked in Tristan's phone/.test(сТелефоном.system));

// --- Разбор -------------------------------------------------------------------------
const ответ = M.разобратьОтвет('{"label":"бар","soundtrack":[{"artist":"A","title":"B"}],"scene":{"source":"радио в баре","radio":"russian pop!!","country":"ru","tracks":[]}}');
проверить('разбор: радио и страна; радио без треков — сцена всё равно есть', ответ.scene && ответ.scene.radio === 'russian pop' && ответ.scene.country === 'RU' && ответ.scene.tracks.length === 0);
const безРадио = M.разобратьОтвет('{"soundtrack":[{"artist":"A","title":"B"}],"scene":{"source":"x","radio":"null","country":"Russia","tracks":[{"artist":"C","title":"D"}]}}');
проверить('разбор: «null» и страна словом — не радио и не страна', безРадио.scene && !('radio' in безРадио.scene) && !('country' in безРадио.scene));
const пл = M.разобратьПлейлист('```json\n{"name":"Ночная трасса","tracks":[{"artist":"A","title":"B","why":"x"},{"artist":"a","title":"b"},"C - D"]}\n```');
проверить('разбор плейлиста: название, без повторов, без пояснений', пл.name === 'Ночная трасса' && пл.tracks.length === 2 && !('why' in пл.tracks[0]) && пл.tracks[1].a === 'C');
const оборванный = M.разобратьПлейлист('{"name":"Тест","tracks":[{"artist":"A","title":"B"},{"artist":"C","title":"D"},{"artist":"E","ti');
проверить('разбор плейлиста: оборванный ответ — целые треки спасаются', оборванный.name === 'Тест' && оборванный.tracks.length === 2);
let пусто = '';
try { M.разобратьПлейлист('{"name":"x","tracks":[]}'); } catch (e) { пусто = e.message; }
проверить('разбор плейлиста: пустой — ошибка', /пустой плейлист/.test(пусто));

// --- Запрос плейлиста ------------------------------------------------------------------
const новый = M.промптПлейлиста({ владелец: 'Tristan', о: 'Age: 24', тема: 'для пробежки', сколько: 6, языкПесни: 'Russian', вкус: вкусТелефона });
проверить('плейлист: просит название, тему, язык без «музыки в сцене», вкус владельца', /"name":"\.\.\."/.test(новый.system) && /- name: /.test(новый.system) && /about: для пробежки/.test(новый.system) && /sung in Russian/.test(новый.system) && !/Scene music/.test(новый.system) && /Tristan's own taste/.test(новый.system) && /PHONE OWNER: Tristan/.test(новый.user));
const ещё = M.промптПлейлиста({ владелец: 'Tristan', уже: [т('A', 'X')], название: 'Ночная трасса', сколько: 5 });
проверить('«Ещё»: без названия, с треками, которые уже есть', !/"name"/.test(ещё.system) && /existing playlist "Ночная трасса"/.test(ещё.system) && /ALREADY IN THE PLAYLIST "Ночная трасса" \(never repeat\): A — X/.test(ещё.user));

// --- Подборка целиком: модель подставная ------------------------------------------------
const блок = (о) => '[HUD]\n```json\n' + JSON.stringify(о) + '\n```\n[/HUD]';
Object.assign(settings, { enableMusic: true, musicVerify: false, enablePhone: false, musicMeme: 'auto', musicRadio: true, musicLang: '', musicLiked: [т('Liked', 'Song')], musicBanned: [т('Bad', 'Song')], musicContextMessages: 1 });
const чат = [{ is_user: false, name: 'Тристан', mes: 'Он поскользнулся на банановой кожуре. ' + блок({ sc: { T: '21:00', Dt: '01.11.24', Md: 'нелепое веселье', At: 'полный абсурд' }, cs: [{ N: 'Тристан', L: 'бар «Волна»' }] }) }];
const запросы = [];
const ctx = {
  chat: чат, chatMetadata: {}, getCurrentChatId: () => 'чат-1', saveChatConditional: async () => {}, saveMetadata: async () => {},
  generateRaw: async ({ prompt, systemPrompt }) => {
    запросы.push(systemPrompt + '\n' + prompt);
    if (/make a playlist|add new songs/.test(systemPrompt + prompt)) {
      return /add new songs/.test(prompt)
        ? '{"tracks":[{"artist":"P1","title":"T1"},{"artist":"P9","title":"T9"},{"artist":"Bad","title":"Song"}]}'
        : '{"name":"Ночная трасса","tracks":[{"artist":"P1","title":"T1"},{"artist":"P2","title":"T2"},{"artist":"Bad","title":"Song"}]}';
    }
    return '{"label":"банановый провал","soundtrack":[{"artist":"Meme","title":"Sad Trombone"},{"artist":"Bad","title":"Song"}],"scene":{"source":"колонка в баре","radio":"russian pop","country":"RU","tracks":[{"artist":"Руки Вверх","title":"18 мне уже"}]}}';
  },
};
globalThis.SillyTavern = { getContext: () => ctx };
await M.подобратьМузыку(0, { вручную: true });
const музыка = D.музыкаХода(чат[0]);
проверить('подборка: сохраняется (ошибки «контекст is not a function» больше нет)', !!музыка && музыка.soundtrack.length === 1, JSON.stringify(музыка));
проверить('подборка: смешная сцена при «по тону сцены» — мемы', музыка && музыка.meme === true && /MEME MODE/.test(запросы[0]));
проверить('подборка: запрещённое отброшено, вкус ушёл модели', музыка && !музыка.soundtrack.some(x => x.a === 'Bad') && /Liked — Song/.test(запросы[0]) && /Bad — Song/.test(запросы[0]));
проверить('подборка: радио сцены хранится тегами и страной', музыка && музыка.scene && музыка.scene.radio === 'russian pop' && музыка.scene.country === 'RU');

// --- Полоса ---------------------------------------------------------------------------
settings.musicPlayer = true;
const полоса = M.полосаМузыки(0, { chat: чат, открыта: true });
проверить('полоса: строка радио с кнопкой эфира и «другой станцией»', /class="hud-music-radio/.test(полоса) && /data-mu="play" data-g="r"/.test(полоса) && /data-mu="radio-next"/.test(полоса));
проверить('полоса: «нравится» и «не предлагать» у трека', /data-mu="like" data-g="s" data-i="0"/.test(полоса) && /data-mu="ban" data-g="s" data-i="0"/.test(полоса));
проверить('полоса: кнопка «Без мемов» у мемной подборки, пометка в подписи', /data-mu="meme"/.test(полоса) && /Без мемов/.test(полоса) && /мемный саундтрек/.test(полоса));
settings.musicBanned = [т('Meme', 'Sad Trombone')];
const сЗапретом = M.полосаМузыки(0, { chat: чат, открыта: true });
проверить('полоса: запрещённый трек зачёркнут и без ▶', /hud-music-tr[^"]*is-banned/.test(сЗапретом) && !/hud-music-artplay[^>]*data-g="s" data-i="0"/.test(сЗапретом));
settings.musicBanned = [т('Bad', 'Song')];
settings.musicRadio = false;
проверить('полоса: радио выключено — строки эфира нет', !/data-mu="radio-next"/.test(M.полосаМузыки(0, { chat: чат, открыта: true })));
settings.musicRadio = true;

// --- Плейлисты телефона: подставная модель ---------------------------------------------------
await M.создатьПлейлист(0, 'THE REGENTS  Tristan');
const либ = L.библиотека(ctx.chatMetadata);
const запись = L.записьВладельца(либ, 'Tristan');
const плейлист = запись && запись.playlists[0];
проверить('плейлист: создан с названием модели, ключ владельца — без приставки карточки', !!плейлист && плейлист.name === 'Ночная трасса' && плейлист.tracks.map(x => x.a).join() === 'P1,P2', JSON.stringify(либ));
проверить('плейлист: запрос — о плейлисте владельца, не о сцене', /make a playlist for Tristan/.test(запросы[запросы.length - 1]) && !/SCENE SNAPSHOT/.test(запросы[запросы.length - 1]));
запись.liked = [т('Fav', 'One')];
чат.push({ is_user: true, name: 'Софи', mes: 'дальше' }, { is_user: false, name: 'Тристан', mes: 'ход' });
await M.создатьПлейлист(0, 'Tristan', { id: плейлист.id });
проверить('«Ещё»: дописаны только новые, запрещённое прочь', плейлист.tracks.map(x => x.a).join() === 'P1,P2,P9' && плейлист.mes === 3, JSON.stringify(плейлист.tracks));
проверить('«Ещё»: модели — что уже есть и «Нравится» владельца', /ALREADY IN THE PLAYLIST "Ночная трасса" \(never repeat\): P1 — T1; P2 — T2/.test(запросы[запросы.length - 1]) && /Fav — One/.test(запросы[запросы.length - 1]) && !/Liked — Song/.test(запросы[запросы.length - 1]));

// --- Экран «Музыки» -----------------------------------------------------------------------
settings.enablePhone = true;
const экран = (вид) => M.приложениеМузыки(0, 'Tristan', { chat: чат, вид });
const списки = экран({ вид: 'lists' });
проверить('экран: вкладки с числами', /data-v="recent"/.test(списки) && /Плейлисты<i>1<\/i>/.test(списки) && /Нравится<i>1<\/i>/.test(списки));
проверить('экран: плейлист карточкой, поле темы и «Создать плейлист»', /class="hud-mphone-pl" data-mu="mview" data-v="list" data-id="/.test(списки) && /Ночная трасса/.test(списки) && /data-mu-set="pltheme"/.test(списки) && /data-mu="pl-new"/.test(списки));
чат.push({ is_user: true, name: 'Софи', mes: 'ещё' });
const открыт = экран({ вид: 'list', id: плейлист.id });
проверить('экран: открытый плейлист — треки с ▶ и ♡, «Ещё» с числом новых сообщений', /data-g="pl:/.test(открыт) && /data-mu="plike"/.test(открыт) && /data-mu="pl-more"/.test(открыт) && /\+1 сообщение/.test(открыт));
проверить('экран: удаление — с подтверждением', /data-mu="pl-del"/.test(открыт) && /data-mu="pl-del-yes"/.test(экран({ вид: 'list', id: плейлист.id, удалить: плейлист.id })));
const лайки = экран({ вид: 'liked' });
проверить('экран: «Нравится» владельца', /Fav/.test(лайки) && /data-g="pf:/.test(лайки));
проверить('экран: неизвестный плейлист — к списку', /hud-mphone-pls/.test(экран({ вид: 'list', id: 'нет' })));

// --- Фон сцены целиком: Фонау, Audius, Incompetech, Commons ------------------------------------
const F = await м('render/music-free.js');
const зСтрах = F.запросФона({ эра: 'modern', род: 'страх', часть: 'ночь', погода: 'ливень' });
проверить('фон: слова по настроению, ночи и дождю', зСтрах.ru.includes('тревожная') && зСтрах.ru[0] === 'дождь' && зСтрах.ru.length <= 4 && зСтрах.en.includes('rain') && зСтрах.feel.includes('Eerie'), JSON.stringify(зСтрах));
проверить('фон: бой важнее настроения, без рода — кинематографичное', F.запросФона({ род: 'нежность', бой: true }).feel.includes('Action') && F.запросФона({}).ru.includes('кинематографичная'));
const фонау = F.трекиФонау([
  { title: { rendered: 'Lobo Loco &#8211; Next Generation (ID 2042)' }, meta: { type: 'single', stream: 'https://fonaucloud.obs.ru-moscow-1.hc.sbercloud.ru/a.mp3', duration: 102000 } },
  { title: { rendered: 'Альбом' }, meta: { type: 'album', stream: '' } },
  { title: { rendered: 'X &#8211; Y' }, meta: { type: 'single', stream: 'http://insecure/a.mp3' } },
]);
проверить('Фонау: только синглы с https-потоком, исполнитель и название из «A – B»', фонау.length === 1 && фонау[0].a === 'Lobo Loco' && фонау[0].t === 'Next Generation (ID 2042)' && фонау[0].сек === 102 && фонау[0].src === 'fonau');
const аудиус = F.трекиAudius({ data: [
  { id: 'a1', title: 'Open', user: { name: 'U' }, access: { stream: true }, duration: 120, genre: 'Ambient', mood: 'Melancholy', artwork: { '150x150': 'https://x/a.jpg' } },
  { id: 'a2', title: 'Closed', user: { name: 'U' }, access: { stream: false }, duration: 120 },
  { id: 'a3', title: 'Loop', user: { name: 'U' }, access: { stream: true }, duration: 30 },
] });
проверить('Audius: только открытый поток и не короче минуты; поток через API', аудиус.length === 1 && аудиус[0].поток === 'https://api.audius.co/v1/tracks/a1/stream?app_name=TavernOS-HUD' && аудиус[0].жанр === 'Ambient, Melancholy' && аудиус[0].art === 'https://x/a.jpg');
const каталог = [
  ['Dark Hall', 'Dark Hall', 'Dark,Eerie', 'piano', 200], ['Happy', 'Happy', 'Bright,Bouncy', 'guitar', 150],
  ['Short', 'Short', 'Dark,Eerie', 'piano', 40], ['Cut (60 second)', 'Cut', 'Dark,Eerie', 'piano', 61],
  ['Tavern', 'The Britons', 'Ren Faire,Medieval', 'lute,recorder', 300], ['Lute Song', 'Lute Song', 'Calming', 'lute', 200],
];
const инк = F.трекиIncompetech(каталог, 'https://incompetech.com/m/', { feel: ['Eerie', 'Dark'] }, () => 0.5);
проверить('Incompetech: по «ощущению», без коротких нарезок', инк.length === 1 && инк[0].t === 'Dark Hall' && инк[0].поток === 'https://incompetech.com/m/Dark%20Hall.mp3' && инк[0].a === 'Kevin MacLeod', JSON.stringify(инк.map(т => т.t)));
const инкСред = F.трекиIncompetech(каталог, 'https://incompetech.com/m/', { feel: ['Calming'], эра: 'medieval' }, () => 0.5).map(т => т.t).sort().join();
проверить('Incompetech: в средневековье — только старинные инструменты', инкСред === 'Lute Song,Tavern', инкСред);
const коммонс = F.трекиCommons({ query: { pages: {
  1: { title: 'File:Anonymous - Saltarello.ogg', imageinfo: [{ url: 'https://upload.wikimedia.org/a/Saltarello.ogg?utm=1', mime: 'application/ogg', size: 900000 }] },
  2: { title: 'File:Bach.mid', imageinfo: [{ url: 'https://upload.wikimedia.org/a/Bach.mid', mime: 'audio/midi', size: 900000 }] },
  3: { title: 'File:Tiny.ogg', imageinfo: [{ url: 'https://upload.wikimedia.org/a/Tiny.ogg', mime: 'audio/ogg', size: 1000 }] },
} } });
проверить('Commons: звук без MIDI и обрывков, адрес без хвоста', коммонс.length === 1 && коммонс[0].a === 'Anonymous' && коммонс[0].t === 'Saltarello' && коммонс[0].поток === 'https://upload.wikimedia.org/a/Saltarello.ogg');
const смесь = F.вперемешку([[т('A', '1'), т('A', '2')], [т('B', '1')], [т('a', '1'), т('C', '1')]], 10);
проверить('фон: источники через один, без повторов', смесь.map(x => x.a + x.t).join() === 'A1,B1,A2,C1');
{
  const былFetch = globalThis.fetch;
  const куда = [];
  globalThis.fetch = async (u) => { куда.push(String(u)); return { ok: true, json: async () => (/commons/.test(u) ? { query: { pages: { 1: { title: 'File:Anon - Estampie.ogg', imageinfo: [{ url: 'https://upload.wikimedia.org/e.ogg', mime: 'audio/ogg', size: 2e6 }] } } } } : []) }; };
  const ср = await F.собратьФон({ эра: 'medieval', род: 'покой' });
  globalThis.fetch = былFetch;
  проверить('фон: в средневековье — без Фонау и Audius, со старинной музыкой', !куда.some(u => /fonau|audius/.test(u)) && куда.some(u => /commons\.wikimedia\.org/.test(u) && /origin=\*/.test(u)) && ср.треки.some(x => x.src === 'commons') && ср.треки.some(x => x.src === 'incompetech'), JSON.stringify(куда));
  globalThis.fetch = async (u) => { куда.push(String(u)); return { ok: true, json: async () => [] }; };
  куда.length = 0;
  await F.собратьФон({ эра: 'modern', род: 'страх' }, { источники: { audius: false, commons: false } });
  globalThis.fetch = былFetch;
  проверить('фон: выключенный источник не спрашивается; наружу — только слова настроения', куда.length && куда.every(u => /fonau\.ru\/wp-json\/wp\/v2\/station\?search=/.test(u)) && !куда.some(u => /audius/.test(u)), куда.join(' '));
}
settings.musicFree = true;
const сФоном = M.полосаМузыки(0, { chat: чат, открыта: true });
проверить('полоса: строка «Фон сцены» с ▶ и «следующим»', /hud-music-free/.test(сФоном) && /data-mu="play" data-g="f"/.test(сФоном) && /data-mu="free-next"/.test(сФоном));
settings.musicFree = false;
проверить('полоса: фон выключен — строки нет', !/hud-music-free/.test(M.полосаМузыки(0, { chat: чат, открыта: true })));
settings.musicFree = true;
проверить('фон: после отрывка — фон сцены; станции и фон забываются при смене чата', /!игра\.полный && фонВключён\(\) && settings\.musicFreeAfter !== false/.test(fs.readFileSync(ROOT + 'render/music.js', 'utf8')) && /радиоХода\.clear\(\); фонХода\.clear\(\)/.test(fs.readFileSync(ROOT + 'render/music.js', 'utf8')));

// --- Подключение -----------------------------------------------------------------------------
const код = fs.readFileSync(ROOT + 'render/music.js', 'utf8');
проверить('значок: плавающий — по IntersectionObserver, гаснет без звука', /new IntersectionObserver/.test(код) && /function обновитьЗначок/.test(код) && /settings\.musicFloat === false/.test(код));
проверить('значок: стиль — крошечный, полупрозрачный, наведение только мышью', /\.hud-mf-dot \{[^}]*width: 26px[^}]*opacity: \.4/.test(fs.readFileSync(ROOT + 'css/music.css', 'utf8')) && /@media \(hover: hover\) and \(pointer: fine\) \{\s*\.hud-mf-dot:hover/.test(fs.readFileSync(ROOT + 'css/music.css', 'utf8')));
проверить('настройки: язык, мемы, радио, значок, вкус', ['hud-music-lang', 'hud-music-meme', 'hud-music-radio', 'hud-music-float', 'hud-music-liked-clear', 'hud-music-banned-clear', 'hud-music-free', 'hud-music-free-after', 'hud-music-free-fonau', 'hud-music-free-audius', 'hud-music-free-incompetech', 'hud-music-free-commons'].every(id => fs.readFileSync(ROOT + 'settings-ui.js', 'utf8').includes(id)));

console.log(`\nпроверок: ${проб}, провалов: ${провалов}`);
process.exitCode = провалов ? 1 : 0;
