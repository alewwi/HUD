// hud-manager/settings.js
//
// Значения по умолчанию и цветовые утилиты HUD.
// Вынесено из index.js без изменения поведения.
//
// SillyTavern грузит только одну точку входа (manifest.json -> "js": "index.js"),
// но подключает её как <script type="module">, поэтому index.js импортирует
// этот файл обычным ES-import'ом. Добавлять модули в manifest.json нельзя —
// поле "js" читается как строка.

export const defaultSettings = {
  // Вкладки, кроме открытой, собираются не сразу, а при первом переключении.
  lazyTabs: true,
  // Сколько собранных HUD-карточек держать в DOM. 0 — не ограничивать.
  hudCardLimit: 0,
  // Карточки сверх лимита прятать совсем: без полоски «HUD свёрнут»,
  // и при прокрутке они не собираются. Блок [HUD] в сообщении остаётся.
  hideOldCards: false,
  // Приложения телефона по отдельности. Выключенное не просится у модели и
  // не показывается на домашнем экране.
  phoneAppMessages: true,
  phoneAppContacts: true,
  phoneAppWallet: true,
  phoneAppCalendar: true,
  phoneAppGallery: true,
  phoneAppNotes: true,
  phoneAppMaps: true,
  phoneAppSearch: true,
  // «Звонки» и «Погода» собираются из того, что уже есть в HUD, — в промт не идут.
  phoneAppCalls: true,
  phoneAppWeather: true,
  phoneAppHealth: true,
  // Эпоха снаряжения: 'modern' — телефон и перехваты, 'medieval' —
  // шкатулка (письма, святцы, кошель, записи, карта, грамоты, памятки) и
  // подслушанное. Вместе пары не работают: в средневековье телефонов нет.
  era: 'modern',
  enableCasket: true,
  enableOverheard: true,
  castAppLetters: true,
  castAppCalendar: true,
  castAppPurse: true,
  castAppNotes: true,
  castAppMap: true,
  castAppDocs: true,
  castAppKeeps: true,
  // Выбранная готовая тема оформления (см. themes.js). Пустая строка —
  // ручные настройки пользователя, ни одна тема не выбрана.
  themePreset: '',
  // Палитра выбранной темы (themes.js, ПАЛИТРЫ). Пусто — основные цвета темы.
  themePalette: '',
  // Правки поверх готовой темы, отдельно на каждую: id темы → изменённые
  // поля. Так «Каваи» помнит свою подстройку, а «Vamp» — свою.
  themeEdits: {},
  // Тема, собранная пользователем целиком: { label, icon, vars }.
  customTheme: null,
  autoInject: true,

  showComments: true,
  enablePhone: true,
  enableIntercepts: true,
  enableDiary: true,
  enableWorld: true,
  enableDreams: true,
  enableUserBlock: true,
  enableMemory: true, // Включаем Память
  // Спутники, болезни и травмы, беременность и ружья Чехова просятся у модели;
  // сводка «что о тебе думают» считается из карточек и в промт не идёт.
  enableCompanions: true,
  enableIllness: true,
  enablePregnancy: true,
  // Роды и малыши: вкладка «Детская», послеродовой период; с какого возраста
  // ребёнок уходит в обычные карточки; число и пол малышей — модели скрытым
  // фактом ('hidden') или только игроку ('off').
  enableBabies: true,
  babyGraduateYears: 3,
  babyFactsToModel: 'hidden',
  enableGuns: true,
  enablePerception: true,
  // Генеалогическое дерево в графе отношений: считается из родства в Rl.
  enableFamilyTree: true,
  // Кнопка «❓» на карточке: вопросы о сюжете, ответ не пишется в чат.
  enableAssistant: true,
  enableMenstruation: true,
  // Вид блока цикла: ring | strip | calendar | moon | hormones | capsule | flower
  // (render/intimacy.js, ВИДЫ_ЦИКЛА). Меняется в окне «Кастомизация».
  cycleView: 'ring',
  // Полоса влечения под циклом: фон по фазе (считает HUD) и точки желания
  // из близости (ds). 'off' | 'phase' | 'phase+actual'.
  cycleLibido: 'phase+actual',
  // Часы сцены: сколько шла близость и что за это время пропустили по
  // расписанию. Сдвиг меньше sceneClockMin минут не показываем.
  // Сетка «кто что знает» над секретами: 'auto' — от трёх секретов.
  secretsGrid: 'auto',
  // Быт (render/life.js): вкладка «Быт» и код hk в памяти. lifeToModel —
  // видит ли модель итог: 'off' — только на экране, 'snapshot' — строкой при
  // снимке, 'macro' — макросом {{hudByt}}, 'keys' — при снимке, но только
  // части по темам последних сообщений (еда, сон, душ, одежда, деньги, дом). sleepNorm — норма сна, часов.
  // Бельё (render/underwear.js): код Un в близости. По умолчанию выключено;
  // показывается под покрывалом. Вид: 'set' — комплект, 'layer' — слоем.
  // Словесная дуэль (render/duel.js): код Vd, только пока идёт спор.
  enableVerbalDuel: true,
  // Бой (render/combat.js): объект cb, только пока есть опасность.
  // combatPrompt — 'auto' | 'always' | 'never', как nsfwPrompt.
  enableCombat: true,
  combatPrompt: 'auto',
  enableUnderwear: false,
  underwearView: 'set',
  underwearVeil: true,
  enableLife: true,
  lifeToModel: 'off',
  // Виды «Быта», дуэли и часов сцены (Кастомизация → Блоки, render/views.js).
  lifeGaugeView: 'rings',
  lifeDayView: 'strip',
  wardrobeView: 'tags',
  duelView: 'tug',
  sceneClockView: 'chips',
  sleepNorm: 8,
  enableSceneClock: true,
  // Темп и X-ray в фазе близости (render/intimacy.js, блокТемпаСцены).
  enableTempo: true,
  sceneClockMin: 15,
  // Вид секций карточки: цвета по смыслу или один, угловые значки, крой полей.
  pillColors: 'smart',
  pillIcons: 'on',
  pillStyle: 'fields',
  // Стиль секций карточки (css/extras.css): '' — обычный; stickers — только
  // на светлых темах; moonglass, ghost, news, win95, mac, bujo, glass, evidence.
  sectionSkin: '',
  // Форма портрета в шапке: auto — арка у «Вампира», круг у остальных.
  avatarShape: 'auto',
  // Рамка портрета: пусто — цвет темы (акцент). Масштаб и сдвиг — как у
  // обоев: кадрирование аватарки внутри рамки, в процентах.
  avatarFrameColor: '', avatarScale: 100, avatarOffsetX: 50, avatarOffsetY: 50,
  // Шапка персонажа: classic — аватарка кружком, banner — полоса из аватарки,
  // visit — визитка: полоса из обоев чата, круглый портрет по центру.
  headerStyle: 'classic',
  // Профиль под именем: уровень, кем приходится игроку, три счётчика. on | off.
  headerProfile: 'off',
  // Имя персонажа: plain | outline (контур с медленным пульсом свечения).
  nameStyle: 'plain',
  // Мысли и реплики в скобках 「」, полосы старого экрана на мыслях,
  // репликах и подтексте, светлее слишком тёмные заголовки на тёмных
  // темах, подпись с именем в конце вкладки. Все — 'on' | 'off'.
  thoughtBrackets: 'off', crtLines: 'off', lightHeadings: 'off', cardSignature: 'off',
  // Своя картинка баннера и визитки: одна на всех персонажей, своя у игрока.
  // Пусто — как было (аватарка у баннера, обои чата у визитки). Сдвиг — в %.
  bannerCharImg: '', bannerCharOffsetX: 50, bannerCharOffsetY: 30,
  bannerUserImg: '', bannerUserOffsetX: 50, bannerUserOffsetY: 30,
  // Находки из тем (css/deco.css), 'on' | 'off': пластырь у «Здоровья», бант
  // на активной вкладке, печать-ханко у имени, ноты у реплик, плашка
  // «модель пишет HUD» при перегенерации, буквица у мыслей, имя столбиком
  // у портрета, счёт дней сюжета под именем.
  healthPlaster: 'off', tabBow: 'off', nameHanko: 'off', lineNotes: 'off', genIndicator: 'off',
  dropCap: 'off', verticalName: 'off', dayCount: 'off',
  // Сердечки и «+N за ход», когда доверие к игроку выросло; ползунок
  // прокрутки и выделение текста цветом темы — у всех тем сразу.
  trustHearts: 'on', themedScroll: 'on',
  // Подвеска на шнуре в шапке, волна под репликами, дракон за плашками — 'on' | 'off';
  // галочки и ползунки по теме в настройках — 'on' | 'off'.
  hangPendant: 'off', lineWave: 'off', bgDragon: 'off', themedControls: 'on',
  // Украшение портрета (css/deco.css): none — как было; theme — своё у
  // каждой темы (index.js, РАМКА_ТЕМЫ); иначе id рамки из РАМКИ_ПОРТРЕТА.
  avatarDeco: 'none',
  // Картинка в углу шапки: off | theme | roses | plum | bridge | cat.
  headerOrnament: 'off',
  // Подписанные разделители между группами строк: off | line | butterfly |
  // mountain | ripple (картинки перекрашены в цвет темы).
  groupDividers: 'off',
  // Бумага вместо зерна: состаренный лист, рваный низ плашек, сгибы
  // письма и сургучная печать в шапке. Каждое — отдельно, 'on' | 'off'.
  paperAged: 'off', paperTorn: 'off', paperFolds: 'off', waxSeal: 'off',
  // Титры в конце сцены: on | off.
  sceneCredits: 'off',
  // Фаза луны по игровой дате: плашка в погоде и тень на луне в небе.
  moonPhase: true,
  // «Глубина»: скрытый подтекст и «О ней» в дневнике открываются нажатием.
  subtextVeil: true,
  diaryVeil: true,
  // Новые блоки промта: состояние тела у персонажей и поворот сюжета в сцене.
  enableBodyState: true,
  enableTwists: true,
  enableIntimacyExtras: true,
  enableHeatMap: true,
  enableEconomy: true,
  enableEvents: true,
  enableCity: true,
  // Гороскоп на 12 знаков и общая цитата удачи — отдельно от прогноза погоды:
  // это чистое развлечение, кому-то не нужно, а строк каждый ход требует много.
  enableHoroscope: true,
  // Сколько последних сообщений читает модель, отвечая на вопрос.
  assistantContextMessages: 12,
  // Что ассистент видит, через какую модель спрашивает и каким промптом.
  assistantIncludeHud: true,
  assistantIncludeNote: true,
  assistantIncludeCard: true,
  assistantIncludePersona: true,
  assistantLorebooks: [],
  assistantLoreAll: false,
  assistantProfileId: '',
  assistantMaxTokens: 1500,
  assistantSystemPrompt: '',
  performanceMode: true, // Автоматическая оптимизация чатов от 200 сообщений
  // В Performance Mode карточка, уехавшая дальше полутора экранов, сворачивается
  // в заглушку своей высоты и собирается заново при возвращении.
  virtualizeCards: true,
  // Старые свёрнутые карточки держат в документе только заголовок.
  lightenOldCards: true,
  // Визуальный перенос списков из прошлых ходов: переписки, секреты,
  // заметки, календарь и прочее не исчезают, если модель забыла их
  // повторить. Только на экране — в запрос ничего не добавляется.
  // Наборы тем: какие категории показывать в ряду пресетов. Пустой объект —
  // показывать все.
  themePacks: {},
  // Мини-гайд: вопросики у вкладок и у знакомых полей.
  showHints: true,
  carryOver: true,
  carryTurns: 20,        // на сколько ходов назад заглядывать
  carryMaxItems: 30,     // не длиннее скольких записей держать список
  carryMaxMessages: 60,  // и не длиннее скольких сообщений — переписку
  // Со снимком 1 — только снимок, история в сводках: полный HUD перед ним
  // почти целиком повторял снимок и стоил тысячи токенов.
  hudsToKeep: 1,
  // Инструкция HUD — отдельным сообщением в самом конце запроса, после всего,
  // что собрал SillyTavern. Выключено — дописывается к последнему сообщению.
  hudPromptSeparate: true,
  // Снимок последнего HUD в конце инструкции: модель обновляет его, а не
  // собирает мир заново. Считается одним из развёрнутых HUD (hudsToKeep).
  hudSnapshot: true,
  // Часть промта про близость: 'auto' — только когда сцена идёт или
  // начинается, 'always' — всегда, 'never' — никогда.
  nsfwPrompt: 'auto',
  // Неполный HUD после ответа (нет мыслей, дневника, гороскопа): 'regen' —
  // досоздать перегенерацией HUD, 'warn' — только предупредить, 'off' — не проверять.
  hudCompleteCheck: 'regen',
  // Противоречия хода с журналом быта (hud-check.js, проблемыОтвета) — туда же.
  hudConsistencyCheck: false,
  regenContextMessages: 6,
  // Сколько последних сообщений уходит модели, когда она пишет запись
  // лорбука по кнопке «Написать моделью». 0 — вообще без контекста сцены.
  loreContextMessages: 10,
  regenProfileId: '',
  hudMaxTokens: 8192,
  hudLorebooks: [],

  // --- РУЧНЫЕ АВАТАРКИ ---
  // avatarOverrides: [{ id, img, names }] — одна картинка на несколько имён
  // ("Арес Бомонт, Ares Beaumont"). Ищется раньше любой автоматики.
  // avatarChar* и avatarUser* — страховка: SillyTavern отдаёт аватарку
  // персонажа по последнему сообщению бота, и если первым в блоке оказался
  // NPC, ему доставалось фото {{char}}. Закреплённые имена это исключают.
  avatarOverrides: [],
  avatarCharImg: '', avatarCharNames: '',
  avatarUserImg: '', avatarUserNames: '',

  // --- ГЛАССМОРФИЗМ И ФОН ---
  backdropBlur: 8,
  bgImage: '',
  bgScale: 100,
  bgOffsetY: 50,
  bgOpacity: 80,

  // Цвет текста. Пустая строка — брать из темы SillyTavern, как было
  // всегда. Раньше настройки для него не существовало вовсе, и светлым
  // темам приходилось прописывать чернила прямо в CSS.
  textColor: '', textMutedColor: '',

  // Тип стекла карточек: frosted | clear | tinted | liquid | iridescent.
  glassType: 'frosted',

  // --- ЦВЕТА И ПРОЗРАЧНОСТЬ ---
  accentColor: '#de859f',
  glowColor: '#8c5ad2', glowAlpha: 40,
  // Размах свечения в процентах (радиусы всех ореолов) и «дыхание»: off, soft, strong.
  glowSize: 100, glowBreath: 'off',
  // Свечение на узком экране: frame — только рамки, full — как на компьютере.
  glowMobile: 'frame',
  // Свечение внутри эмулятора телефона: on или off.
  phoneGlow: 'on',

  cardBgStart: '#0f0f14', cardBgEnd: '#0f0f14', cardBgAlpha: 15,
  infoBlockBgStart: '#000000', infoBlockBgEnd: '#000000', infoBlockBgAlpha: 15,
  memoryBgStart: '#15121c', memoryBgEnd: '#0d0d14', memoryBgAlpha: 22,
  memoryAccent: '#8c5ad2', memoryGlowAlpha: 28, memoryBlur: 8, memoryMaxHeight: 300,

  topBarBg: '#0f0f14', topBarAlpha: 25,
  tabsBg: '#000000', tabsAlpha: 15,

  sceneOverlayColor: '#000000', sceneOverlayAlpha: 0,
  // Сила ночного затемнения сцены в процентах. 100 — как было заложено,
  // 0 — сцена вообще не притемняется. По умолчанию 80: три слоя затемнения
  // перемножаются, и полная сила съедала пейзаж.
  sceneDarkness: 55,
  sceneTextColor: '#ffffff',
  // --- НАСТРОЙКИ ТЕЛЕФОНА (сохранены для темы/будущего эмулятора; сам эмулятор отключён) ---
  msgInBg: '#ffffff', msgInAlpha: 15,
  msgOutStart: '#2badde', msgOutEnd: '#a9789a', msgOutAlpha: 80,

  // --- ВНЕШНИЙ ВИД ТЕЛЕФОНА ---
  // Телефон переделан в полноценную ОС, поэтому набор пересобран: убраны
  // enablePhoneSettings и phoneShowLockNotifications — их не читал ни код,
  // ни панель. Добавлены те, что относятся к ОС: радиус плиток приложений,
  // цвет корпуса, свечение экрана и число карточек уведомлений на домашнем
  // экране.
  // phoneThemeAuto — «Наследовать тему HUD»: фон, акцент, блюр и шрифт
  // телефон берёт у HUD; правка любого из них галочку снимает (events.js).
  phoneThemeAuto: true,
  phoneBgStart: '#0a0a0f', phoneBgEnd: '#12121a', phoneBgAlpha: 92,
  phoneAccent: '#de859f',
  phoneBlur: 14,
  phoneBubbleRadius: 15,
  phoneFont: 'inherit',
  phoneFontSize: 13,
  phoneNotifAlpha: 94,
  phoneIconRadius: 15,
  phoneFrameColor: '#16171d',
  phoneScreenGlow: 35,
  phoneNotifMax: 3,
  weatherBgColor: '#000000', weatherBgAlpha: 40, weatherBlur: 6, // Цвета погоды

  badgeColor: '#ff3b30',

  dramaColor: '#ff3b30', dramaBgAlpha: 15,
  interceptColor: '#ff4d4d', interceptBgAlpha: 15,
  nsfwColor: '#9e2a3f', nsfwBgAlpha: 20,

  clockColor: '#ffffff',

  // --- ШРИФТЫ И РАЗМЕРЫ ---
  fontMain: 'inherit', fontSizeMain: 14,
  fontHeaders: 'inherit', fontSizeHeaders: 13,
  fontClock: 'system-ui, sans-serif', fontSizeClock: 42,
  fontDiary: "'Caveat', cursive", fontSizeDiary: 16,
};

// Свежая копия дефолтов. Копия, а не сам объект: loadSettings() мутирует
// результат через Object.assign, а hudLorebooks — массив, который иначе
// оказался бы общим с defaultSettings.
function createDefaultSettings() {
  // structuredClone появился не во всех браузерах, которыми открывают
  // SillyTavern с телефона. Настройки — простые данные без функций и
  // ссылок по кругу, поэтому обход через JSON здесь равноценен.
  if (typeof structuredClone === 'function') {
    try { return structuredClone(defaultSettings); } catch (_) { /* ниже */ }
  }
  return JSON.parse(JSON.stringify(defaultSettings));
}

export function hexToRgba(hex, alpha) {
    alpha = alpha === undefined ? 100 : Number(alpha);
    if (isNaN(alpha)) alpha = 100;
    if (typeof hex !== 'string' || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) hex = '#000000';
    let c = hex.substring(1).split('');
    if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    c = '0x' + c.join(''); return `rgba(${[(c>>16)&255, (c>>8)&255, c&255].join(', ')}, ${alpha / 100})`;
}

// Живой объект настроек, общий для всех модулей.
//
// Единственный экземпляр на страницу: loadSettings() в index.js наполняет его
// через Object.assign, то есть МУТИРУЕТ на месте и не переприсваивает. Поэтому
// импортирующие модули видят актуальные значения без геттеров и без прокидывания
// настроек параметрами через три уровня вызовов.
//
// Присваивать `settings = ...` нельзя — импортированная привязка только на чтение.
// Меняй поля (`settings.foo = ...`) или Object.assign(settings, ...).
export const settings = createDefaultSettings();

// «Авто (по теме)» у украшений из тем (Кастомизация → Вид блоков): значение
// берётся по выбранной теме. Тема не в списке — украшение выключено.
// Строка из id — включено у этих тем; объект — своё значение у каждой.
const ПО_ТЕМЕ = {
  sectionSkin: { japan: 'double', academia: 'double', kawaii: 'notebook', cottage: 'notebook', noir: 'evidence', mafia: 'evidence', web1: 'label', witch: 'moonglass', spaceopera: 'moonglass', ice: 'glass', ocean: 'glass' },
  headerStyle: { kawaii: 'visit', cottage: 'visit' },
  nameStyle: { academia: 'foil', egypt: 'foil', mafia: 'foil', vamp: 'outline', cyberpunk: 'outline', spacehorror: 'outline', voodoo: 'outline', kawaii: 'sheen', fantasy: 'sheen', ice: 'sheen', ocean: 'sheen', witch: 'sheen', spaceopera: 'sheen' },
  groupDividers: { kawaii: 'butterfly', cottage: 'butterfly', solarpunk: 'butterfly', japan: 'medallion', ice: 'mountain', ocean: 'ripple', medieval: 'line', academia: 'line', fantasy: 'line', vamp: 'line', witch: 'line' },
  headerProfile: 'kawaii web1 cyberpunk',
  thoughtBrackets: 'japan',
  crtLines: 'cyberpunk web1 spacehorror',
  cardSignature: 'academia vamp fantasy witch cottage medieval',
  paperAged: 'academia medieval western pirate steampunk cottage egypt',
  paperTorn: 'medieval pirate western',
  paperFolds: 'academia steampunk dieselpunk noir mafia',
  waxSeal: 'academia vamp medieval fantasy cottage mafia witch',
  nameHanko: 'japan',
  verticalName: 'japan',
  dayCount: 'vamp academia noir cyberpunk japan kawaii spaceopera spacehorror pirate witch',
  tabBow: 'kawaii cottage',
  lineNotes: 'kawaii vamp witch fantasy',
  healthPlaster: 'kawaii cottage web1',
  dropCap: 'academia medieval fantasy witch vamp cottage',
  hangPendant: 'japan',
  lineWave: 'japan kawaii witch',
  bgDragon: 'fantasy',
};
// У всех тем сразу: читаемые заголовки, сердечки, прокрутка, плашка генерации.
const ВСЕМ_ТЕМАМ = { lightHeadings: 'on', trustHearts: 'on', themedScroll: 'on', genIndicator: 'on', themedControls: 'on' };
const ВЫКЛЮЧЕНО = { sectionSkin: '', headerStyle: 'classic', nameStyle: 'plain', groupDividers: 'off' };
export function настройка(ключ) {
  const v = settings[ключ];
  if (v !== 'auto') return v;
  if (ВСЕМ_ТЕМАМ[ключ]) return ВСЕМ_ТЕМАМ[ключ];
  const тема = settings.themePreset || '';
  const правило = ПО_ТЕМЕ[ключ];
  if (typeof правило === 'string') return правило.split(' ').includes(тема) ? 'on' : 'off';
  return (правило && правило[тема]) || (ключ in ВЫКЛЮЧЕНО ? ВЫКЛЮЧЕНО[ключ] : 'off');
}
// Ключи, у которых в Кастомизации есть «Авто (по теме)».
export const КЛЮЧИ_АВТО = [...Object.keys(ПО_ТЕМЕ), ...Object.keys(ВСЕМ_ТЕМАМ)];
// «Минимализм» (Кастомизация → Вид блоков): все украшения из тем выключены —
// рамки, картинки угла, разделители, бумага, печать, имя, визитка, мелочи,
// галочки и ползунки по теме, светлые заголовки.
export const МИНИМАЛИЗМ = {
  pillColors: 'mono', pillIcons: 'off', pillStyle: 'plain',
  avatarDeco: 'none', headerOrnament: 'off',
  ...Object.fromEntries(КЛЮЧИ_АВТО.map(к => [к, к in ВЫКЛЮЧЕНО ? ВЫКЛЮЧЕНО[к] : 'off'])),
};
