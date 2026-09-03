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
  // Выбранная готовая тема оформления (см. themes.js). Пустая строка —
  // ручные настройки пользователя, ни одна тема не выбрана.
  themePreset: '',
  autoInject: true,
  useCards: true,
  showComments: true,
  enablePhone: true,
  enableIntercepts: true,
  enableDiary: true,
  enableWorld: true,
  enableDreams: true,
  enableUserBlock: true,
  enableMemory: true, // Включаем Память
  performanceMode: true, // Автоматическая оптимизация чатов от 200 сообщений
  hudsToKeep: 2,
  regenContextMessages: 6,
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

  // --- ЦВЕТА И ПРОЗРАЧНОСТЬ ---
  accentColor: '#de859f',
  glowColor: '#8c5ad2', glowAlpha: 40,

  cardBgStart: '#0f0f14', cardBgEnd: '#0f0f14', cardBgAlpha: 15,
  infoBlockBgStart: '#000000', infoBlockBgEnd: '#000000', infoBlockBgAlpha: 15,
  memoryBgStart: '#15121c', memoryBgEnd: '#0d0d14', memoryBgAlpha: 22,
  memoryAccent: '#8c5ad2', memoryGlowAlpha: 28, memoryBlur: 8, memoryMaxHeight: 300,

  topBarBg: '#0f0f14', topBarAlpha: 25,
  tabsBg: '#000000', tabsAlpha: 15,

  sceneOverlayColor: '#000000', sceneOverlayAlpha: 0,
  sceneTextColor: '#ffffff',
  // --- НАСТРОЙКИ ТЕЛЕФОНА (сохранены для темы/будущего эмулятора; сам эмулятор отключён) ---
  msgInBg: '#ffffff', msgInAlpha: 15,
  msgOutStart: '#2badde', msgOutEnd: '#a9789a', msgOutAlpha: 80,

  // --- ВНЕШНИЙ ВИД ТЕЛЕФОНА ---
  // Телефон переделан в полноценную ОС, поэтому набор пересобран: убраны
  // phoneThemeAuto, enablePhoneSettings и phoneShowLockNotifications —
  // их не читал ни код, ни панель. Добавлены те, что относятся к ОС:
  // радиус плиток приложений, цвет корпуса, свечение экрана и число
  // карточек уведомлений на домашнем экране.
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
export function createDefaultSettings() {
  return structuredClone(defaultSettings);
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
