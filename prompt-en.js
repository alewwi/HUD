// hud-manager/prompt-en.js
//
// Инструкция HUD на английском интерфейсе (i18n.js). Правила и схема в
// prompt.js уже английские, а примеры значений — русские: по ним модель
// понимает, на каком языке писать HUD. Здесь — замены: русский пример →
// английский, «write values in Russian» → in English, русские слова
// перечислений (этапы боя, тон спора, бельё) → английские, которые разбор
// тоже понимает. Применяется к готовой инструкции целиком.

const ЗАМЕНЫ = [
  // Язык и коды.
  ['- 🌍 LANG: write values in Russian; character names follow "N".', '- 🌍 LANG: write values in English; character names follow "N".'],
  ['the HUD expands them into Russian itself', 'the HUD expands them into words itself'],
  ['The place is in Russian words', 'The place is in English words'],

  // Телефон.
  ['«Вчера, 22:30»', '«Yesterday, 22:30»'],
  ['«Позавчера, 19:05»', '«Two days ago, 19:05»'],
  ['[VOICE_0:42] Перезвони мне | 21:40', '[VOICE_0:42] Call me back | 21:40'],
  ['[PHOTO: селфи в примерочной, новое платье] Ну как? | 18:20', '[PHOTO: a selfie in the fitting room, a new dress] Well? | 18:20'],
  ['[VIDEO_0:23: снимает на бегу, кричит и смеётся] Смотри! | 18:22', '[VIDEO_0:23: filming on the run, shouting and laughing] Look! | 18:22'],
  ['[REPLY: Лена :: Ты придёшь?] Да, буду к восьми | 20:01', '[REPLY: Lena :: Are you coming?] Yes, I\'ll be there by eight | 20:01'],
  ['[FWD: Отдел кадров] Совещание переносится | 20:03', '[FWD: HR] The meeting is postponed | 20:03'],
  ['[POLL: Куда идём в пятницу? ;; Кафе = Лена, Петя ;; Кино = Мира ;; Никуда] | 20:05', '[POLL: Where are we going on Friday? ;; Café = Lena, Pete ;; Cinema = Mira ;; Nowhere] | 20:05'],

  // Сцена.
  ['21:40 | поздний вечер', '21:40 | late evening'],
  ['мелкий дождь, +6°C, ветер с реки', 'light rain, +6°C, wind from the river'],
  ['«1) Софи может поехать и узнать, кто её ждёт; 2) или промолчать — и тогда письмо найдёт Тристан»', '«1) Sophie may go and find out who is waiting; 2) or keep quiet — and then Tristan finds the letter»'],
  ['«ёлочки»', '«guillemets»'],

  // Персонаж.
  ["'М' or 'Ж'", "'M' or 'F'"],
  ['голова, грудь, спина, левое плечо, правое бедро…', 'head, chest, back, left shoulder, right thigh…'],
  ['14:30 - встреча с юристом', '14:30 - meeting with a lawyer'],
  ['Ричард: муж, любит, но боится', 'Richard: husband, loves him but is afraid of him'],
  ['tn: спор | укол | ссора | крик | холод | примирение', 'tn: argument | jab | quarrel | shouting | cold | reconciliation'],
  ['ещё не закончилось', 'not over yet'],
  ['Потерять Софи: high; Отец узнает: moderate', 'Losing Sophie: high; Father finds out: moderate'],
  ['fear: Потерять Софи — strength: high', 'fear: Losing Sophie — strength: high'],
  ['Потерять Софи: high', 'Losing Sophie: high'],
  ['Софи: 82; Ричард: 9', 'Sophie: 82; Richard: 9'],
  ['Шрам: левая бровь — тонкая белая полоса | получен: в 14 лет, драка', 'Scar: left eyebrow — a thin white line | obtained: at 14, a fight'],
  ['Несмотря на угрозы и обещания расправы, он осторожно, почти нежно перебинтовывает ей правую руку, словно боится сделать больно', 'For all his threats and promises of revenge, he bandages her right hand carefully, almost tenderly, as if afraid to hurt her'],
  ["'| получен: <date, age or event>'", "'| obtained: <date, age or event>'"],
  ["'| получен: <when>'", "'| obtained: <when>'"],
  ['Синяк: левое предплечье — желтеет по краям, ноет при нажатии | 5d; Ссадины: костяшки правой руки — подсохли корочкой | 2d', 'Bruise: left forearm — yellowing at the edges, aches when pressed | 5d; Scrapes: knuckles of the right hand — scabbed over | 2d'],

  // Близость.
  ['lb: течёт так, что внутренняя сторона бёдер блестит, бельё промокло ещё в прелюдии, каждое движение отдаётся влажным звуком', 'lb: so wet the inner thighs glisten, the underwear soaked through during foreplay, every movement makes a wet sound'],
  ['pb: гладко выбрита, узкая полоска светлых волос над клитором, кожа нежная после бритья', 'pb: smoothly shaved, a narrow strip of light hair above the clitoris, the skin soft after shaving'],
  ['lb: влажно', 'lb: wet'],
  ['pb: ухоженный', 'pb: groomed'],
  ['на боку, он сзади, рука на её горле, двигается медленно и глубоко', 'on her side, he is behind her, a hand on her throat, moving slowly and deep'],
  ['condom: порвался на втором заходе, заметили не сразу', 'condom: broke on the second go, they didn\'t notice right away'],
  ['none: оба знают и идут на риск', 'none: both know and take the risk'],
  ['85: сбивается дыхание, бёдра дрожат, шепчет «не останавливайся»', '85: her breath catches, her thighs tremble, she whispers «don\'t stop»'],
  ['Стоны: 8 — низкие, срываются на всхлип при толчке; Скрип кровати: 5 — ритмичный', 'Moans: 8 — low, breaking into a sob with each thrust; Creaking bed: 5 — rhythmic'],
  ['Шея: 9 peak — губы и зубы, кожа горит; Бёдра: 6 rising — дрожат под его ладонью', 'Neck: 9 peak — lips and teeth, the skin burns; Thighs: 6 rising — trembling under his palm'],
  ['Шея: 9 — горит от его губ; Бёдра: 7 — дрожат под ладонью', 'Neck: 9 — burning from his lips; Thighs: 7 — trembling under the palm'],
  ['or не думая; st: на месте | сдвинуто | снято | потеряно', 'or without thinking; st: on | moved | off | lost'],
  ['Ролевые игры: охотно, сценарий врач-пациент; Связывание: только сама сверху', 'Role-play: eagerly, a doctor-patient scenario; Bondage: only when she is on top'],
  ['Чулки: обязательное условие; Шея: сильный триггер', 'Stockings: a must; Neck: strong trigger'],
  ['Боль: панический страх; Втроём: не делится', 'Pain: panic fear; Threesome: doesn\'t share'],
  ['Спешка: сразу теряет настрой', 'Rushing: loses the mood at once'],
  ['Молча обнять и не говорить ни слова — любые слова разрушат ощущение сейчас', 'Hold her in silence and say nothing — any words would break the feeling now'],
  ['«не останавливайся»', '«don\'t stop»'],

  // Игрок, телефон, шкатулка.
  ['главный персонаж', 'main character'],
  ['вход в Колдуэлл-холл', 'entrance to Caldwell Hall'],
  ['Не брать трубку', 'Don\'t pick up'],
  ['Смотрели вчера в 23:40', 'Watched yesterday at 23:40'],
  ['Кофейня на углу', 'Coffee shop on the corner'],
  ['Перевод от [имя]', 'Transfer from [name]'],
  ['День рождения [имя]', 'Birthday of [name]'],
  ['Дом [имя]', 'Home of [name]'],
  ['Сегодня, 14:30', 'Today, 14:30'],
  ['Совет директоров', 'Board meeting'],
  ['Фестиваль огней', 'Festival of lights'],
  ['Сегодня, к обедне', 'Today, by mass'],
  ['3 зол, 14 сер, 27 мед', '3 gold, 14 silver, 27 copper'],
  ['Постой в «Хромом гусе»', 'Lodging at the «Lame Goose»'],
  ['«Хромом гусе»', '«Lame Goose»'],
  ['Жалованье от лорда', 'Wages from the lord'],
  ['Подкуп стражника', 'Bribing a guard'],
  ['красный воск, вепрь дома Эштон', 'red wax, the boar of House Ashton'],
  ['в конюшне за перегородкой', 'in the stable behind the partition'],
  ['под окном трапезной', 'under the refectory window'],
  ['рыжий кот', 'ginger cat'],
  ['ворон-фамильяр', 'raven familiar'],
  ['боевой дрон', 'combat drone'],
  ['дочь Софи и Тристана', 'daughter of Sophie and Tristan'],
  ['Доллар | 92,4 ₽ | +0,3', 'Euro | 1.08 $ | +0.3'],
  ['Хлеб | 64 ₽ | подорожал', 'Bread | 3.50 $ | got pricier'],
  ['Засос: шея слева — наливается фиолетовым, ноет | 5d; Следы ногтей: спина — красные полосы | 2d', 'Hickey: left side of the neck — turning purple, aching | 5d; Nail marks: back — red lines | 2d'],
  ['кредиты, эдди, крышки.', 'credits, eddies, caps.'],
  ['(отец, сестра, отчим… the same)', '(father, sister, stepfather… the same)'],
  ['(муж, сестра, отчим)', '(husband, sister, stepfather)'],
  ['(возлюбленная, начальник, соперник, незнакомка, спасительница, одержимость)', '(beloved, boss, rival, stranger, rescuer, obsession)'],
  ['однокурсница, одноклассник, коллега', 'classmate, schoolmate, colleague'],
  ["her side 'мой преподаватель', 'научный руководитель', his side 'его студентка', 'ученица'; never just 'студентка'", "her side 'my professor', 'my supervisor', his side 'his student', 'his pupil'; never just 'student'"],
  ["'Софи: одержимость, не может перестать следить за ней'", "'Sophie: obsession, can't stop watching her'"],
  ["'Софи: незнакомка, спасла его брата и пугает своей прямотой'", "'Sophie: stranger, saved his brother and scares him with her bluntness'"],
  ["('девушка на диване')", "('the girl on the couch')"],
  ['[неразборчиво]', '[illegible]'],
  ['12 дней', '12 days'],
  ['3 месяца', '3 months'],

  // Бой: этапы, стороны, дистанции, состояния, выдержка.
  ['угроза | схватка | пауза | погоня | кончено', 'threat | fight | pause | chase | over'],
  ['write кончено for one turn', 'write over for one turn'],
  ['<своя | враг | нейтрал>; <вплотную | шаг | через комнату | далеко>', '<ally | enemy | neutral>; <close | step | across the room | far>'],
  ['<цел | ранен | оглушён | вне строя>', '<unharmed | wounded | stunned | out of action>'],
  ['<действует | дрожит | замер | паникует | бежит>', '<acting | shaking | freezing | panicking | fleeing>'],
];

// Отдельные слова — только целиком, в кавычках или как значение примера.
const СЛОВА = [
  ["'Универ'", "'Uni'"], ["'Аренда'", "'Rent'"], ["'Вчера'", "'Yesterday'"], ["'прерывистый'", "'broken'"],
  ["'к вечерне'", "'by vespers'"], ["'на рассвете'", "'at dawn'"], ["'в полдень'", "'at noon'"],
  ["'кроны'", "'crowns'"], ["'флорины'", "'florins'"], ["'денье'", "'deniers'"], ["'-2 сер'", "'-2 silver'"], ["'+1 зол'", "'+1 gold'"],
  ["'ухоженный'", "'groomed'"], ["'стандартно'", "'standard'"], ["'влажно'", "'wet'"], ["'да'", "'yes'"], ["'Вы'", "'You'"],
  ['фон}', 'background}'],
];

/** Инструкция HUD с английскими примерами вместо русских. */
export function промптНаАнглийском(текст) {
  let s = String(текст || '');
  for (const [ru, en] of ЗАМЕНЫ) if (s.includes(ru)) s = s.split(ru).join(en);
  for (const [ru, en] of СЛОВА) if (s.includes(ru)) s = s.split(ru).join(en);
  return s;
}
