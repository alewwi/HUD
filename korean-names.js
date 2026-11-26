// В записях «фамилия личное имя» фамилия не служит коротким именем героя.
const фамилии = new Map();
for (const ряд of [
  'ким kim gim 김', 'ли lee yi rhee 이', 'пак pak park bak 박', 'чхве чхой choi choe 최',
  'чон jeong jung chung 정', 'jeon 전', 'кан kang gang 강', 'чо cho jo 조',
  'юн yun yoon 윤', 'чан jang chang 장', 'им lim im rim 임', 'хан han 한',
  'о oh 오', 'со seo suh 서', 'син шин shin sin 신', 'квон kwon gwon 권',
  'хван hwang 황', 'ан ahn an 안', 'сон song 송', 'рю ryu 류',
  'хон hong 홍', 'ко go koh 고', 'мун moon mun 문', 'ян yang 양', 'сонг',
  'пэ bae 배', 'пэк baek paik 백', 'хо heo 허', 'нам nam 남', 'сим shim sim 심',
  'мин min 민', 'у woo 우', 'ю yoo yu 유', 'ён yeon 연', 'ом eom 엄', 'тхэ tae 태', 'ван wang 왕', 'пён byeon 변', 'сок seok 석', 'чин jin 진', 'чу ju 주', 'квак kwak gwak 곽', 'ёнг yeong 영', 'сён seong 성',
  'но noh roh 노', 'ха ha 하', 'ма ma 마', 'ча cha 차', 'ку koo gu 구',
]) {
  const слова = ряд.split(' ');
  for (const слово of слова) фамилии.set(слово, слова[0]);
}

export function корейскаяФамилия(имя) {
  const первое = String(имя || '').trim().toLowerCase().split(/\s+/, 1)[0];
  return фамилии.get(первое) || '';
}

const фамилииКитаяИЯпонии = new Set((
  'ван wang ли li чжан zhang лю liu чэнь chen ян yang хуан huang чжао zhao у wu чжоу zhou сюй xu сунь sun ма ma чжу zhu линь lin ' +
  'го guo хэ he ло luo лян liang сян xiang фан fang фэн feng шэнь shen сяо xiao е ye су su лэй lei оуян ouyang сыма sima ' +
  'чжэн zheng сюн xiong тянь tian цао cao цай cai цзян jiang цяо qiao юань yuan дэн deng ху hu хань han ' +
  'сато sato satō судзуки suzuki такахаси takahashi танака tanaka ватанабэ watanabe ито ito itō ямамото yamamoto ' +
  'накамура nakamura кобаяси kobayashi като kato katō ёсида yoshida ямада yamada сасаки sasaki ямагути yamaguchi ' +
  'мацумото matsumoto иноуэ inoue кимура kimura хаяси hayashi симидзу shimizu сайто saito saitō такахаши кобаяши'
).split(/\s+/));

export const иероглифыИКана = текст => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(текст);
// Макроны латиницы снимаем (Satō → sato), а «й» и «ё» остаются собой: иначе
// «Уайт» читался как «уаит», а «Ёсида» не находилась в словаре.
const безДиакритики = слово => String(слово || '').toLowerCase().normalize('NFD').replace(/(?<=[a-z])\p{M}+/gu, '').normalize('NFC');
const вСловаре = слово => фамилииКитаяИЯпонии.has(безДиакритики(слово));
export const известнаяФамилия = слово => !!корейскаяФамилия(слово) || вСловаре(String(слово));

// Эти слова есть в словаре фамилий, но в русских и западных сюжетах чаще
// означают имя: «Ян Ковальский», «Ким Уайт», Lee Adama, Han Solo, Jo March,
// «Дэн Браун», «Ван Хельсинг». Фамилией они считаются, только когда остальная
// часть имени похожа на корейское или китайское имя.
const ЕЩЁ_И_ИМЯ = new Set(['ян', 'ким', 'kim', 'lee', 'han', 'хан', 'jo', 'дэн', 'ван', 'lin', 'ли']);
// Слоги корейской и китайской записи: «Минсу», «Намджун», «Тэхён», «Вэй»,
// Minsu, Namjoon, Wukong. «Ковальский», «Уайт», Possible и March сюда не
// подходят. Ошибка в редком случае (Solo, Adama) только просит полное имя.
const СЛОГИ_КИРИЛЛИЦЕЙ = /^(?:(?:чх|чж|дж|кк|тт|пп|сс|цз|в(?=э)|[кгндтрлмбпсчхцшжз])?(?:ый|ой|ай|эй|уй|(?:ао|яо|оу|уа|уо|уэ|иа|ие|ио|иу|[аяоёуюыиэе])(?:нг|ль|нь|[кнтлмпй](?![аяоёуюыиэе]))?))+$/u;
const СЛОГИ_ЛАТИНИЦЕЙ = /^(?:(?:ch|jj|kk|pp|ss|tt|zh|sh|ts|[bcdfghjklmnprstwxyz])?(?:yae|yeo|wae|ae|ai|ao|ei|eo|eu|ia|ie|io|iu|oe|oo|ou|ua|ue|ui|uo|wa|we|wi|wo|ya|ye|yo|yu|[aeiou])(?:ng|[kmnlpt](?![aeiou]))?)+$/u;
export function похожеНаВосточное(часть) {
  const s = безДиакритики(часть).replace(/[\s'’-]/g, '').replace(/ё/g, 'е');
  if (!s || s.length > 24) return false;
  if (иероглифыИКана(s) || /[가-힣]/u.test(s)) return true;
  return /^[а-я]+$/u.test(s) ? СЛОГИ_КИРИЛЛИЦЕЙ.test(s) : /^[a-z]+$/.test(s) && СЛОГИ_ЛАТИНИЦЕЙ.test(s);
}
const ещёИИмя = слово => ЕЩЁ_И_ИМЯ.has(безДиакритики(слово).replace(/ё/g, 'е'));

/**
 * Где в полном имени фамилия: «Пак Минсу» → { фамилия: 'пак', личное: 'минсу' },
 * «Aoi Tanaka» → { фамилия: 'tanaka', личное: 'aoi' }. null — имя не похоже
 * на корейское, китайское или японское («Ян Ковальский», «Анна Смит»).
 */
export function разборВосточногоИмени(имя) {
  const слова = String(имя || '').trim().split(/\s+/).filter(Boolean);
  if (слова.length < 2) return null;
  const ключ = слово => корейскаяФамилия(слово) || безДиакритики(слово).replace(/ё/g, 'е');
  const [первое, ...дальше] = слова;
  if (известнаяФамилия(первое) && (!ещёИИмя(первое) || похожеНаВосточное(дальше.join(''))))
    return { фамилия: ключ(первое), личное: дальше.join(' ') };
  const последнее = слова.at(-1);
  if (вСловаре(последнее) && (!ещёИИмя(последнее) || похожеНаВосточное(слова.slice(0, -1).join(''))))
    return { фамилия: ключ(последнее), личное: слова.slice(0, -1).join(' ') };
  return null;
}

// Слово, которое в этом чате носят двое с полными именами, хотя бы одно из
// которых восточное: «ким» при Ким Намджуне и Ким Тэхёне, «аой» при Аой Танаке
// и Аой Ямаде, «танака» при Аой и Хару Танаке. Заполняет names.js
// (запомнитьРазныхЛюдей), чистит при смене чата.
export const ОБЩИЕ_СЛОВА = new Set();
export const словоИмени = (слово) => String(слово || '').normalize('NFKC').replace(/[’'`]/g, '').trim().toLowerCase().replace(/ё/g, 'е');

// Первое слово имени — не его короткая форма: у «Ким Минсу» это фамилия,
// у иероглифов и хангыля пробелов нет вовсе. Одно слово («Ян», «Ким») — само
// себе полное имя, а «Ян Ковальский» по-прежнему просто Ян.
export function нужноПолноеИмя(имя) {
  const s = String(имя || '').trim();
  if (иероглифыИКана(s) || /[가-힣]/u.test(s)) return true;
  const слова = s.split(/\s+/).filter(Boolean);
  if (слова.length < 2) return false;
  // Одно из слов в этом чате носят двое: короткой формы у такого имени нет.
  if (ОБЩИЕ_СЛОВА.size && слова.some(с => ОБЩИЕ_СЛОВА.has(словоИмени(с)))) return true;
  return известнаяФамилия(слова[0]) && (!ещёИИмя(слова[0]) || похожеНаВосточное(слова.slice(1).join('')));
}
