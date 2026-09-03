// hud-manager/themes.js
//
// Готовые темы оформления HUD.
//
// Тема состоит из двух частей:
//   1) vars   — значения обычных настроек кастомизации. Их применяет
//               applyThemeColors() ровно так же, как если бы пользователь
//               выставил каждый ползунок руками. Поэтому после применения
//               темы всё остаётся редактируемым: тема — это пресет, а не
//               отдельный режим.
//   2) класс  — hud-theme-<id> на <html>. За ним в style.css закреплены
//               украшения (кофе и книги, капли крови, полицейская лента) и
//               цвет текста для светлых тем: --hud-text наследуется из темы
//               SillyTavern, и на пергаменте или розовом фоне светлый текст
//               был бы нечитаем, а обычной настройки для него нет.
//
// Ключи в vars — те же, что в settings.js. Незнакомые ключи не пишем: их
// applyThemeColors() всё равно не читает.

export const HUD_THEMES = [
  {
    id: 'kawaii', label: 'Каваи', icon: '🎀',
    hint: 'Пастельно-розовая, светлая. Каомодзи и зайки над блоками.',
    vars: {
      accentColor: '#e0568f', glowColor: '#ffa8d5', glowAlpha: 45,
      cardBgStart: '#fde7f1', cardBgEnd: '#f9d5e8', cardBgAlpha: 92,
      infoBlockBgStart: '#ffffff', infoBlockBgEnd: '#ffeef6', infoBlockBgAlpha: 62,
      memoryBgStart: '#fff2f8', memoryBgEnd: '#ffe0ef', memoryBgAlpha: 92,
      memoryAccent: '#e0568f', memoryGlowAlpha: 26, memoryBlur: 6,
      topBarBg: '#ffd9ec', topBarAlpha: 68, tabsBg: '#ffe9f4', tabsAlpha: 55,
      phoneBgStart: '#ffe6f2', phoneBgEnd: '#ffcfe5', phoneBgAlpha: 94,
      phoneAccent: '#e0568f', phoneFrameColor: '#f6b9d5', phoneScreenGlow: 22,
      msgInBg: '#ffffff', msgInAlpha: 72,
      msgOutStart: '#ff9fc9', msgOutEnd: '#ffc2de', msgOutAlpha: 88,
      weatherBgColor: '#ffffff', weatherBgAlpha: 42, weatherBlur: 5,
      sceneOverlayColor: '#ff9ecb', sceneOverlayAlpha: 10,
      badgeColor: '#ff4f9c', dramaColor: '#f2568f', dramaBgAlpha: 14,
      interceptColor: '#e0568f', interceptBgAlpha: 14,
      nsfwColor: '#d43f7e', nsfwBgAlpha: 16,
      clockColor: '#6b2a45', backdropBlur: 6,
      fontMain: "'Nunito', sans-serif", fontHeaders: "'Comfortaa', cursive",
      fontDiary: "'Pangolin', cursive",
    },
  },
  {
    id: 'academia', label: 'Dark Academia', icon: '📚',
    hint: 'Чёрный, коричневый, карий. Кофе и корешки книг.',
    vars: {
      accentColor: '#c9a227', glowColor: '#6b4a2f', glowAlpha: 32,
      cardBgStart: '#1d1710', cardBgEnd: '#100e0a', cardBgAlpha: 42,
      infoBlockBgStart: '#0d0b08', infoBlockBgEnd: '#0d0b08', infoBlockBgAlpha: 26,
      memoryBgStart: '#1a140e', memoryBgEnd: '#0f0d0a', memoryBgAlpha: 34,
      memoryAccent: '#a9782f', memoryGlowAlpha: 20, memoryBlur: 8,
      topBarBg: '#17120c', topBarAlpha: 46, tabsBg: '#0e0b08', tabsAlpha: 34,
      phoneBgStart: '#16110c', phoneBgEnd: '#0b0907', phoneBgAlpha: 94,
      phoneAccent: '#c9a227', phoneFrameColor: '#2a2118', phoneScreenGlow: 24,
      msgInBg: '#d8c7a8', msgInAlpha: 12,
      msgOutStart: '#6b4a2f', msgOutEnd: '#3f2c1c', msgOutAlpha: 84,
      weatherBgColor: '#120e0a', weatherBgAlpha: 52, weatherBlur: 6,
      sceneOverlayColor: '#3a2a18', sceneOverlayAlpha: 16,
      badgeColor: '#a33a2a', dramaColor: '#a33a2a', dramaBgAlpha: 14,
      interceptColor: '#8a6a3a', interceptBgAlpha: 14,
      nsfwColor: '#7a4a2a', nsfwBgAlpha: 18,
      clockColor: '#e8d9b8', backdropBlur: 9,
      fontMain: "'Lora', serif", fontHeaders: "'Cormorant Garamond', serif",
      fontDiary: "'Marck Script', cursive",
    },
  },
  {
    id: 'vamp', label: 'Vamp', icon: '🩸',
    hint: 'Вино, багрянец, чернь. Капли крови, клыки, летучие мыши.',
    vars: {
      accentColor: '#c31f38', glowColor: '#7a0d1e', glowAlpha: 44,
      cardBgStart: '#1a070c', cardBgEnd: '#0c0407', cardBgAlpha: 46,
      infoBlockBgStart: '#0a0305', infoBlockBgEnd: '#0a0305', infoBlockBgAlpha: 28,
      memoryBgStart: '#190710', memoryBgEnd: '#0d0509', memoryBgAlpha: 36,
      memoryAccent: '#8e1327', memoryGlowAlpha: 30, memoryBlur: 9,
      topBarBg: '#14060a', topBarAlpha: 50, tabsBg: '#0a0305', tabsAlpha: 38,
      phoneBgStart: '#17070c', phoneBgEnd: '#0a0407', phoneBgAlpha: 94,
      phoneAccent: '#c31f38', phoneFrameColor: '#25090f', phoneScreenGlow: 30,
      msgInBg: '#e8b8c0', msgInAlpha: 12,
      msgOutStart: '#7a0d1e', msgOutEnd: '#3d0710', msgOutAlpha: 86,
      weatherBgColor: '#12050a', weatherBgAlpha: 54, weatherBlur: 7,
      sceneOverlayColor: '#5a0a18', sceneOverlayAlpha: 18,
      badgeColor: '#c31f38', dramaColor: '#c31f38', dramaBgAlpha: 16,
      interceptColor: '#b0182f', interceptBgAlpha: 16,
      nsfwColor: '#8e1327', nsfwBgAlpha: 20,
      clockColor: '#e8c7cd', backdropBlur: 10,
      fontMain: "'Alice', serif", fontHeaders: "'Playfair Display', serif",
      fontDiary: "'Bad Script', cursive",
    },
  },
  {
    id: 'cyberpunk', label: 'Киберпанк', icon: '🖥',
    hint: 'Фиолет, циан, алый. Глитч, развёртка, терминал.',
    vars: {
      accentColor: '#b06bff', glowColor: '#2de2ff', glowAlpha: 52,
      cardBgStart: '#0d0a1e', cardBgEnd: '#060512', cardBgAlpha: 46,
      infoBlockBgStart: '#05040f', infoBlockBgEnd: '#05040f', infoBlockBgAlpha: 30,
      memoryBgStart: '#0e0a22', memoryBgEnd: '#06050f', memoryBgAlpha: 38,
      memoryAccent: '#2de2ff', memoryGlowAlpha: 36, memoryBlur: 10,
      topBarBg: '#0a0820', topBarAlpha: 52, tabsBg: '#06041a', tabsAlpha: 40,
      phoneBgStart: '#0b0a1c', phoneBgEnd: '#05040f', phoneBgAlpha: 94,
      phoneAccent: '#2de2ff', phoneFrameColor: '#141033', phoneScreenGlow: 62,
      msgInBg: '#7fd8ff', msgInAlpha: 14,
      msgOutStart: '#7a2dff', msgOutEnd: '#2de2ff', msgOutAlpha: 78,
      weatherBgColor: '#07061a', weatherBgAlpha: 52, weatherBlur: 8,
      sceneOverlayColor: '#2a0a5a', sceneOverlayAlpha: 18,
      badgeColor: '#ff2d6f', dramaColor: '#ff2d6f', dramaBgAlpha: 16,
      interceptColor: '#2de2ff', interceptBgAlpha: 16,
      nsfwColor: '#ff2d6f', nsfwBgAlpha: 18,
      clockColor: '#2de2ff', backdropBlur: 12,
      fontMain: "'Jura', sans-serif", fontHeaders: "'Unbounded', sans-serif",
      fontClock: "'Rubik Mono One', sans-serif", fontDiary: "'Courier New', monospace",
    },
  },
  {
    id: 'noir', label: 'Нуар', icon: '🔍',
    hint: 'Только чёрное и белое. Жалюзи, револьвер, лупа.',
    vars: {
      accentColor: '#d8d8d8', glowColor: '#ffffff', glowAlpha: 18,
      cardBgStart: '#141414', cardBgEnd: '#080808', cardBgAlpha: 48,
      infoBlockBgStart: '#000000', infoBlockBgEnd: '#000000', infoBlockBgAlpha: 30,
      memoryBgStart: '#151515', memoryBgEnd: '#0a0a0a', memoryBgAlpha: 38,
      memoryAccent: '#bdbdbd', memoryGlowAlpha: 14, memoryBlur: 6,
      topBarBg: '#101010', topBarAlpha: 52, tabsBg: '#000000', tabsAlpha: 42,
      phoneBgStart: '#151515', phoneBgEnd: '#080808', phoneBgAlpha: 95,
      phoneAccent: '#d8d8d8', phoneFrameColor: '#1c1c1c', phoneScreenGlow: 16,
      msgInBg: '#ffffff', msgInAlpha: 14,
      msgOutStart: '#4a4a4a', msgOutEnd: '#232323', msgOutAlpha: 88,
      weatherBgColor: '#000000', weatherBgAlpha: 52, weatherBlur: 4,
      sceneOverlayColor: '#000000', sceneOverlayAlpha: 22,
      badgeColor: '#9a9a9a', dramaColor: '#bdbdbd', dramaBgAlpha: 14,
      interceptColor: '#d8d8d8', interceptBgAlpha: 12,
      nsfwColor: '#7a7a7a', nsfwBgAlpha: 16,
      clockColor: '#f2f2f2', backdropBlur: 5,
      fontMain: "'Oswald', sans-serif", fontHeaders: "'Oswald', sans-serif",
      fontDiary: "'Courier New', monospace",
    },
  },
  {
    id: 'medieval', label: 'Средневековье', icon: '👑',
    hint: 'Пергамент, серебро клинка, золото короны.',
    vars: {
      accentColor: '#8a6a1f', glowColor: '#d9c48a', glowAlpha: 34,
      cardBgStart: '#efe3c6', cardBgEnd: '#e0cfa9', cardBgAlpha: 92,
      infoBlockBgStart: '#fffaf0', infoBlockBgEnd: '#f4e9cf', infoBlockBgAlpha: 58,
      memoryBgStart: '#f3e8cd', memoryBgEnd: '#e6d6b2', memoryBgAlpha: 92,
      memoryAccent: '#8a6a1f', memoryGlowAlpha: 22, memoryBlur: 5,
      topBarBg: '#e6d5b0', topBarAlpha: 72, tabsBg: '#f2e7cc', tabsAlpha: 58,
      phoneBgStart: '#efe3c6', phoneBgEnd: '#dcc79c', phoneBgAlpha: 94,
      phoneAccent: '#8a6a1f', phoneFrameColor: '#b9a374', phoneScreenGlow: 18,
      msgInBg: '#fffaf0', msgInAlpha: 76,
      msgOutStart: '#c9a227', msgOutEnd: '#a9852a', msgOutAlpha: 86,
      weatherBgColor: '#ffffff', weatherBgAlpha: 40, weatherBlur: 4,
      sceneOverlayColor: '#c9a227', sceneOverlayAlpha: 12,
      badgeColor: '#9a2d1f', dramaColor: '#9a2d1f', dramaBgAlpha: 14,
      interceptColor: '#7a6a3a', interceptBgAlpha: 14,
      nsfwColor: '#8a3a2a', nsfwBgAlpha: 16,
      clockColor: '#3a2c15', backdropBlur: 4,
      fontMain: "'Kurale', serif", fontHeaders: "'Eczar', serif",
      fontDiary: "'Marck Script', cursive",
    },
  },
  {
    id: 'mafia', label: 'Криминал', icon: '🔪',
    hint: 'Чернь и алый, острые углы. Оцепление, нож, жетон.',
    vars: {
      accentColor: '#d92b2b', glowColor: '#000000', glowAlpha: 52,
      cardBgStart: '#121212', cardBgEnd: '#040404', cardBgAlpha: 56,
      infoBlockBgStart: '#000000', infoBlockBgEnd: '#000000', infoBlockBgAlpha: 34,
      memoryBgStart: '#131313', memoryBgEnd: '#050505', memoryBgAlpha: 44,
      memoryAccent: '#d92b2b', memoryGlowAlpha: 18, memoryBlur: 4,
      topBarBg: '#0d0d0d', topBarAlpha: 62, tabsBg: '#000000', tabsAlpha: 46,
      phoneBgStart: '#101010', phoneBgEnd: '#040404', phoneBgAlpha: 96,
      phoneAccent: '#d92b2b', phoneFrameColor: '#161616', phoneScreenGlow: 14,
      phoneBubbleRadius: 4, phoneIconRadius: 6,
      msgInBg: '#ffffff', msgInAlpha: 12,
      msgOutStart: '#8c1717', msgOutEnd: '#3d0808', msgOutAlpha: 90,
      weatherBgColor: '#000000', weatherBgAlpha: 58, weatherBlur: 3,
      sceneOverlayColor: '#000000', sceneOverlayAlpha: 20,
      badgeColor: '#d92b2b', dramaColor: '#d92b2b', dramaBgAlpha: 18,
      interceptColor: '#d92b2b', interceptBgAlpha: 18,
      nsfwColor: '#8c1717', nsfwBgAlpha: 20,
      clockColor: '#f0f0f0', backdropBlur: 3,
      fontMain: "'Oswald', sans-serif", fontHeaders: "'Russo One', sans-serif",
      fontDiary: "'Courier New', monospace",
    },
  },
];

export const HUD_THEME_IDS = HUD_THEMES.map(t => t.id);

export function getTheme(id) {
  return HUD_THEMES.find(t => t.id === id) || null;
}

// Класс темы вешаем на <html>: правила вида :root.hud-theme-medieval
// перебивают обычный :root, где живут переменные HUD.
export function applyThemeClass(id) {
  const root = document.documentElement;
  if (!root) return;
  HUD_THEME_IDS.forEach(t => root.classList.remove('hud-theme-' + t));
  if (id && HUD_THEME_IDS.includes(id)) root.classList.add('hud-theme-' + id);
}
