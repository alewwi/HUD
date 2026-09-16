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

import { settings } from './settings.js?v=22.99.70';

const HUD_THEMES = [
  {
    id: 'kawaii', label: 'Каваи', icon: '🎀', category: 'cozy',
    hint: 'Пастельно-розовая, светлая. Каомодзи и зайки над блоками.',
    vars: {
      textColor: '#4a2338', textMutedColor: '#7a4a63',
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
    id: 'academia', label: 'Dark Academia', icon: '📚', category: 'classic',
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
    id: 'vamp', label: 'Vamp', icon: '🩸', category: 'mystic',
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
    id: 'cyberpunk', label: 'Киберпанк', icon: '🖥', category: 'punk',
    hint: 'Фиолет, циан, алый. Глитч, развёртка, терминал.',
    vars: {
      glassType: 'tinted',
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
    id: 'noir', label: 'Нуар', icon: '🔍', category: 'classic',
    hint: 'Только чёрное и белое. Жалюзи, револьвер, лупа.',
    vars: {
      glassType: 'clear',
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
    id: 'medieval', label: 'Средневековье', icon: '👑', category: 'history',
    hint: 'Пергамент, серебро клинка, золото короны.',
    vars: {
      textColor: '#3a2c15', textMutedColor: '#6b5a3a',
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
    id: 'fantasy', label: 'Фэнтези', icon: '✦', category: 'mystic',
    hint: 'Изумруд, аметист и золото искр. Руны, светлячки, дым.',
    vars: {
      accentColor: '#7fe0c0', glowColor: '#9a6bff', glowAlpha: 46,
      cardBgStart: '#0c1a18', cardBgEnd: '#080f14', cardBgAlpha: 46,
      infoBlockBgStart: '#061012', infoBlockBgEnd: '#061012', infoBlockBgAlpha: 28,
      memoryBgStart: '#0b1a1c', memoryBgEnd: '#070f12', memoryBgAlpha: 38,
      memoryAccent: '#9a6bff', memoryGlowAlpha: 34, memoryBlur: 10,
      topBarBg: '#0a1618', topBarAlpha: 50, tabsBg: '#060f11', tabsAlpha: 38,
      phoneBgStart: '#0b1a18', phoneBgEnd: '#060e12', phoneBgAlpha: 94,
      phoneAccent: '#7fe0c0', phoneFrameColor: '#12241f', phoneScreenGlow: 40,
      msgInBg: '#9fe8d4', msgInAlpha: 13,
      msgOutStart: '#2f7a68', msgOutEnd: '#5a3f9c', msgOutAlpha: 84,
      weatherBgColor: '#07120f', weatherBgAlpha: 52, weatherBlur: 8,
      sceneOverlayColor: '#1a4a3c', sceneOverlayAlpha: 16,
      badgeColor: '#e0a84a', dramaColor: '#c96a3a', dramaBgAlpha: 15,
      interceptColor: '#9a6bff', interceptBgAlpha: 15,
      nsfwColor: '#8a4a7a', nsfwBgAlpha: 18,
      clockColor: '#cfeee2', backdropBlur: 11,
      fontMain: "'Philosopher', sans-serif", fontHeaders: "'Kurale', serif",
      fontDiary: "'Marck Script', cursive",
    },
  },
  {
    id: 'mafia', label: 'Криминал', icon: '🔪', category: 'classic',
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
  {
    id: 'web1', label: 'Web 1.0', icon: '\u2593', category: 'cozy',
    hint: 'Серый металлик и синий заголовок. Счётчик гостей, UNDER CONSTRUCTION.',
    vars: {
      glassType: 'clear',
      textColor: '#000000', textMutedColor: '#4a4a4a',
      accentColor: '#000080', glowColor: '#008080', glowAlpha: 16,
      cardBgStart: '#c0c0c0', cardBgEnd: '#d4d0c8', cardBgAlpha: 97,
      infoBlockBgStart: '#ffffff', infoBlockBgEnd: '#ffffff', infoBlockBgAlpha: 88,
      memoryBgStart: '#ffffff', memoryBgEnd: '#e9e9e9', memoryBgAlpha: 94,
      memoryAccent: '#000080', memoryGlowAlpha: 10, memoryBlur: 0,
      topBarBg: '#000080', topBarAlpha: 97, tabsBg: '#c0c0c0', tabsAlpha: 92,
      phoneBgStart: '#c0c0c0', phoneBgEnd: '#d4d0c8', phoneBgAlpha: 98,
      phoneAccent: '#000080', phoneFrameColor: '#808080', phoneScreenGlow: 0,
      phoneBubbleRadius: 2, phoneIconRadius: 2,
      msgInBg: '#ffffff', msgInAlpha: 92,
      msgOutStart: '#000080', msgOutEnd: '#0000c8', msgOutAlpha: 94,
      weatherBgColor: '#ffffff', weatherBgAlpha: 74, weatherBlur: 0,
      sceneOverlayColor: '#008080', sceneOverlayAlpha: 10,
      badgeColor: '#ff0000', dramaColor: '#ff0000', dramaBgAlpha: 12,
      interceptColor: '#008080', interceptBgAlpha: 12,
      nsfwColor: '#800000', nsfwBgAlpha: 14,
      clockColor: '#000080', backdropBlur: 0,
      fontMain: "'Courier New', monospace", fontHeaders: "'Press Start 2P', cursive",
      fontDiary: "'Courier New', monospace",
    },
  },
  {
    id: 'cottage', label: 'Коттеджкор', icon: '\u2741', category: 'cozy',
    hint: 'Бумага, лён и топлёное молоко. Грибы, сухоцветы, подписи от руки.',
    vars: {
      textColor: '#4a4034', textMutedColor: '#7a6f5e',
      accentColor: '#6f8452', glowColor: '#c9b98f', glowAlpha: 30,
      cardBgStart: '#f5efe0', cardBgEnd: '#e9dfc7', cardBgAlpha: 94,
      infoBlockBgStart: '#fffdf6', infoBlockBgEnd: '#fdf7e8', infoBlockBgAlpha: 70,
      memoryBgStart: '#fbf6ea', memoryBgEnd: '#efe6cf', memoryBgAlpha: 94,
      memoryAccent: '#6f8452', memoryGlowAlpha: 18, memoryBlur: 4,
      topBarBg: '#e6dcc3', topBarAlpha: 78, tabsBg: '#f2ead8', tabsAlpha: 62,
      phoneBgStart: '#f5efe0', phoneBgEnd: '#e4d8bd', phoneBgAlpha: 95,
      phoneAccent: '#6f8452', phoneFrameColor: '#c3b28a', phoneScreenGlow: 14,
      msgInBg: '#fffdf6', msgInAlpha: 82,
      msgOutStart: '#a8b884', msgOutEnd: '#87996a', msgOutAlpha: 88,
      weatherBgColor: '#fffdf6', weatherBgAlpha: 46, weatherBlur: 3,
      sceneOverlayColor: '#c9b98f', sceneOverlayAlpha: 12,
      badgeColor: '#b06a4a', dramaColor: '#b06a4a', dramaBgAlpha: 13,
      interceptColor: '#6f8452', interceptBgAlpha: 13,
      nsfwColor: '#a4595f', nsfwBgAlpha: 15,
      clockColor: '#4a4034', backdropBlur: 4,
      fontMain: "'Open Sans', sans-serif", fontHeaders: "'Amatic SC', cursive",
      fontDiary: "'Neucha', cursive",
    },
  },
  {
    id: 'ice', label: 'Лёд', icon: '\u2745', category: 'nature',
    hint: 'Прозрачные панели, иней по краям, кристаллы и преломление света.',
    vars: {
      glassType: 'iridescent',
      accentColor: '#7fd4e8', glowColor: '#bfeeff', glowAlpha: 34,
      cardBgStart: '#0e1a22', cardBgEnd: '#091219', cardBgAlpha: 32,
      infoBlockBgStart: '#ffffff', infoBlockBgEnd: '#cfeaf5', infoBlockBgAlpha: 9,
      memoryBgStart: '#0d1c26', memoryBgEnd: '#081118', memoryBgAlpha: 30,
      memoryAccent: '#7fd4e8', memoryGlowAlpha: 26, memoryBlur: 16,
      topBarBg: '#0d1a22', topBarAlpha: 42, tabsBg: '#081119', tabsAlpha: 32,
      phoneBgStart: '#0f1c24', phoneBgEnd: '#07111a', phoneBgAlpha: 88,
      phoneAccent: '#7fd4e8', phoneFrameColor: '#1d3542', phoneScreenGlow: 44,
      msgInBg: '#ffffff', msgInAlpha: 15,
      msgOutStart: '#2b7fa0', msgOutEnd: '#164a63', msgOutAlpha: 76,
      weatherBgColor: '#0a1a24', weatherBgAlpha: 40, weatherBlur: 14,
      sceneOverlayColor: '#8fd8ee', sceneOverlayAlpha: 10,
      badgeColor: '#5fc9e8', dramaColor: '#7fd4e8', dramaBgAlpha: 14,
      interceptColor: '#9fe4f5', interceptBgAlpha: 13,
      nsfwColor: '#5f9fb8', nsfwBgAlpha: 15,
      clockColor: '#cdeffa', backdropBlur: 18,
      fontMain: "'Exo 2', sans-serif", fontHeaders: "'Philosopher', sans-serif",
      fontDiary: "'Caveat', cursive",
    },
  },
  {
    id: 'ocean', label: 'Глубина', icon: '\u2248', category: 'nature',
    hint: 'Синяя толща воды. Пузырьки, каустика, лучи света, медленные волны.',
    vars: {
      glassType: 'liquid',
      accentColor: '#4fd8c8', glowColor: '#1d7fa8', glowAlpha: 40,
      cardBgStart: '#062032', cardBgEnd: '#03121d', cardBgAlpha: 54,
      infoBlockBgStart: '#0a2a3d', infoBlockBgEnd: '#061c2a', infoBlockBgAlpha: 32,
      memoryBgStart: '#06222f', memoryBgEnd: '#03131e', memoryBgAlpha: 42,
      memoryAccent: '#4fd8c8', memoryGlowAlpha: 28, memoryBlur: 12,
      topBarBg: '#04202f', topBarAlpha: 60, tabsBg: '#031521', tabsAlpha: 44,
      phoneBgStart: '#06202f', phoneBgEnd: '#03121c', phoneBgAlpha: 93,
      phoneAccent: '#4fd8c8', phoneFrameColor: '#0c2c3c', phoneScreenGlow: 38,
      msgInBg: '#9fe8ff', msgInAlpha: 13,
      msgOutStart: '#0f6d80', msgOutEnd: '#083b4d', msgOutAlpha: 84,
      weatherBgColor: '#04202f', weatherBgAlpha: 50, weatherBlur: 10,
      sceneOverlayColor: '#0a4a6a', sceneOverlayAlpha: 18,
      badgeColor: '#ff8a5c', dramaColor: '#ff8a5c', dramaBgAlpha: 15,
      interceptColor: '#4fd8c8', interceptBgAlpha: 15,
      nsfwColor: '#2f8fa8', nsfwBgAlpha: 17,
      clockColor: '#a8f0e6', backdropBlur: 12,
      fontMain: "'Montserrat', sans-serif", fontHeaders: "'Kelly Slab', cursive",
      fontDiary: "'Pacifico', cursive",
    },
  },
  {
    id: 'steampunk', label: 'Стимпанк', icon: '⚙', category: 'punk',
    hint: 'Латунь, пар и шестерёнки. Тёплая медь по тёмному металлу.',
    vars: {
      glassType: 'tinted',
      accentColor: '#d69b4a', glowColor: '#8a5a1e', glowAlpha: 38,
      cardBgStart: '#2a2018', cardBgEnd: '#171009', cardBgAlpha: 58,
      infoBlockBgStart: '#332618', infoBlockBgEnd: '#221709', infoBlockBgAlpha: 34,
      memoryBgStart: '#2b2015', memoryBgEnd: '#18110a', memoryBgAlpha: 46,
      memoryAccent: '#d69b4a', memoryGlowAlpha: 26, memoryBlur: 9,
      topBarBg: '#241a10', topBarAlpha: 62, tabsBg: '#1a1209', tabsAlpha: 46,
      phoneBgStart: '#241b12', phoneBgEnd: '#140e08', phoneBgAlpha: 94,
      phoneAccent: '#d69b4a', phoneFrameColor: '#3d2c18', phoneScreenGlow: 30,
      msgInBg: '#e8cfa0', msgInAlpha: 12,
      msgOutStart: '#8a5a1e', msgOutEnd: '#4a2f0d', msgOutAlpha: 86,
      weatherBgColor: '#241a10', weatherBgAlpha: 52, weatherBlur: 8,
      sceneOverlayColor: '#8a5a1e', sceneOverlayAlpha: 16,
      badgeColor: '#c9622a', dramaColor: '#c9622a', dramaBgAlpha: 16,
      interceptColor: '#d69b4a', interceptBgAlpha: 15,
      nsfwColor: '#b0703a', nsfwBgAlpha: 18,
      clockColor: '#f0d5a8', backdropBlur: 9,
      fontMain: "'Alice', serif", fontHeaders: "'Cinzel', serif",
      fontDiary: "'Bad Script', cursive",
    },
  },
  {
    id: 'dieselpunk', label: 'Дизельпанк', icon: '⛭', category: 'punk',
    hint: 'Тяжёлая индустрия: хром, мазут, заклёпки и предупредительная жёлтая.',
    vars: {
      glassType: 'clear',
      accentColor: '#e0b83a', glowColor: '#4a4f55', glowAlpha: 30,
      cardBgStart: '#1e2124', cardBgEnd: '#101214', cardBgAlpha: 62,
      infoBlockBgStart: '#262a2e', infoBlockBgEnd: '#16181b', infoBlockBgAlpha: 36,
      memoryBgStart: '#202427', memoryBgEnd: '#121416', memoryBgAlpha: 48,
      memoryAccent: '#e0b83a', memoryGlowAlpha: 20, memoryBlur: 5,
      topBarBg: '#191c1f', topBarAlpha: 66, tabsBg: '#131517', tabsAlpha: 50,
      phoneBgStart: '#1c1f22', phoneBgEnd: '#0e1012', phoneBgAlpha: 95,
      phoneAccent: '#e0b83a', phoneFrameColor: '#2e3236', phoneScreenGlow: 22,
      msgInBg: '#c9d2d8', msgInAlpha: 11,
      msgOutStart: '#5a6067', msgOutEnd: '#2c3034', msgOutAlpha: 88,
      weatherBgColor: '#191c1f', weatherBgAlpha: 56, weatherBlur: 5,
      sceneOverlayColor: '#3a4046', sceneOverlayAlpha: 18,
      badgeColor: '#e05a2a', dramaColor: '#e05a2a', dramaBgAlpha: 16,
      interceptColor: '#e0b83a', interceptBgAlpha: 14,
      nsfwColor: '#a8542a', nsfwBgAlpha: 16,
      clockColor: '#f0dc9a', backdropBlur: 4,
      fontMain: "'Oswald', sans-serif", fontHeaders: "'Staatliches', cursive",
      fontDiary: "'Special Elite', cursive",
    },
  },
  {
    id: 'solarpunk', label: 'Солярпанк', icon: '☀', category: 'punk',
    hint: 'Светлая: зелень, стекло и солнце. Живые растения на белом.',
    vars: {
      glassType: 'clear',
      textColor: '#1f3a2a', textMutedColor: '#4d6b58',
      accentColor: '#2e9e6b', glowColor: '#8fe0b0', glowAlpha: 36,
      cardBgStart: '#f2fbf5', cardBgEnd: '#e2f4e8', cardBgAlpha: 90,
      infoBlockBgStart: '#ffffff', infoBlockBgEnd: '#eefaf1', infoBlockBgAlpha: 64,
      memoryBgStart: '#f4fcf7', memoryBgEnd: '#e4f6ea', memoryBgAlpha: 90,
      memoryAccent: '#2e9e6b', memoryGlowAlpha: 22, memoryBlur: 5,
      topBarBg: '#dcf2e3', topBarAlpha: 66, tabsBg: '#eaf8ee', tabsAlpha: 56,
      phoneBgStart: '#eafaef', phoneBgEnd: '#d6f0de', phoneBgAlpha: 94,
      phoneAccent: '#2e9e6b', phoneFrameColor: '#bfe4cc', phoneScreenGlow: 18,
      msgInBg: '#ffffff', msgInAlpha: 76,
      msgOutStart: '#7fd0a0', msgOutEnd: '#a8e4c0', msgOutAlpha: 88,
      weatherBgColor: '#ffffff', weatherBgAlpha: 46, weatherBlur: 4,
      sceneOverlayColor: '#8fe0b0', sceneOverlayAlpha: 10,
      badgeColor: '#e8a33a', dramaColor: '#d97d2e', dramaBgAlpha: 14,
      interceptColor: '#2e9e6b', interceptBgAlpha: 13,
      nsfwColor: '#c26a4a', nsfwBgAlpha: 15,
      clockColor: '#1f3a2a', backdropBlur: 4,
      fontMain: "'Nunito', sans-serif", fontHeaders: "'Comfortaa', cursive",
      fontDiary: "'Caveat', cursive",
    },
  },
  {
    id: 'biopunk', label: 'Биопанк', icon: '🧬', category: 'punk',
    hint: 'Плоть, ДНК, органика. Влажная зелень с розовой подсветкой.',
    vars: {
      glassType: 'liquid',
      accentColor: '#8fe36a', glowColor: '#3c7a2a', glowAlpha: 42,
      cardBgStart: '#12200f', cardBgEnd: '#0a1408', cardBgAlpha: 58,
      infoBlockBgStart: '#1a2c14', infoBlockBgEnd: '#0e1a0a', infoBlockBgAlpha: 34,
      memoryBgStart: '#14240f', memoryBgEnd: '#0b1508', memoryBgAlpha: 46,
      memoryAccent: '#8fe36a', memoryGlowAlpha: 30, memoryBlur: 13,
      topBarBg: '#12200d', topBarAlpha: 62, tabsBg: '#0c1608', tabsAlpha: 46,
      phoneBgStart: '#13210e', phoneBgEnd: '#0a1207', phoneBgAlpha: 94,
      phoneAccent: '#8fe36a', phoneFrameColor: '#1e3418', phoneScreenGlow: 40,
      msgInBg: '#d8ffc0', msgInAlpha: 12,
      msgOutStart: '#3c7a2a', msgOutEnd: '#1d4014', msgOutAlpha: 86,
      weatherBgColor: '#12200d', weatherBgAlpha: 52, weatherBlur: 12,
      sceneOverlayColor: '#4a8a3a', sceneOverlayAlpha: 18,
      badgeColor: '#ff6ba8', dramaColor: '#ff6ba8', dramaBgAlpha: 17,
      interceptColor: '#8fe36a', interceptBgAlpha: 15,
      nsfwColor: '#d4568f', nsfwBgAlpha: 20,
      clockColor: '#c8f0a8', backdropBlur: 13,
      fontMain: "'Montserrat', sans-serif", fontHeaders: "'Orbitron', sans-serif",
      fontDiary: "'Shadows Into Light', cursive",
    },
  },
  {
    id: 'spaceopera', label: 'Космоопера', icon: '🚀', category: 'space',
    hint: 'Звёзды, неон и шлемы. Глубокий космос с фиолетовой подсветкой.',
    vars: {
      glassType: 'iridescent',
      accentColor: '#7db8ff', glowColor: '#5a3ae0', glowAlpha: 44,
      cardBgStart: '#0e1030', cardBgEnd: '#06071a', cardBgAlpha: 56,
      infoBlockBgStart: '#151843', infoBlockBgEnd: '#0a0c26', infoBlockBgAlpha: 34,
      memoryBgStart: '#101234', memoryBgEnd: '#07081c', memoryBgAlpha: 46,
      memoryAccent: '#7db8ff', memoryGlowAlpha: 32, memoryBlur: 12,
      topBarBg: '#0c0e28', topBarAlpha: 62, tabsBg: '#07081c', tabsAlpha: 48,
      phoneBgStart: '#0e1030', phoneBgEnd: '#06071a', phoneBgAlpha: 94,
      phoneAccent: '#7db8ff', phoneFrameColor: '#1a1d48', phoneScreenGlow: 42,
      msgInBg: '#bcd6ff', msgInAlpha: 13,
      msgOutStart: '#3a3ae0', msgOutEnd: '#1d1d70', msgOutAlpha: 86,
      weatherBgColor: '#0c0e28', weatherBgAlpha: 54, weatherBlur: 11,
      sceneOverlayColor: '#3a2ae0', sceneOverlayAlpha: 18,
      badgeColor: '#ff5ad0', dramaColor: '#ff5ad0', dramaBgAlpha: 16,
      interceptColor: '#7db8ff', interceptBgAlpha: 15,
      nsfwColor: '#a05ae0', nsfwBgAlpha: 18,
      clockColor: '#cfe2ff', backdropBlur: 12,
      fontMain: "'Exo 2', sans-serif", fontHeaders: "'Orbitron', sans-serif",
      fontDiary: "'Share Tech Mono', monospace",
    },
  },
  {
    id: 'japan', label: 'Феодальная Япония', icon: '🌸', category: 'history',
    hint: 'Светлая: бумага васи, тушь суми-э и сакура.',
    vars: {
      glassType: 'clear',
      textColor: '#2e2622', textMutedColor: '#6b5c52',
      accentColor: '#b3403f', glowColor: '#e8b8b0', glowAlpha: 30,
      cardBgStart: '#f7f2e8', cardBgEnd: '#efe6d6', cardBgAlpha: 92,
      infoBlockBgStart: '#fffdf7', infoBlockBgEnd: '#f5eede', infoBlockBgAlpha: 62,
      memoryBgStart: '#f9f4ea', memoryBgEnd: '#f0e7d6', memoryBgAlpha: 90,
      memoryAccent: '#b3403f', memoryGlowAlpha: 18, memoryBlur: 4,
      topBarBg: '#eee3cf', topBarAlpha: 66, tabsBg: '#f5ecdc', tabsAlpha: 56,
      phoneBgStart: '#f7f0e2', phoneBgEnd: '#e9dcc6', phoneBgAlpha: 94,
      phoneAccent: '#b3403f', phoneFrameColor: '#d8c6a8', phoneScreenGlow: 14,
      msgInBg: '#ffffff', msgInAlpha: 74,
      msgOutStart: '#d99a92', msgOutEnd: '#e8bdb6', msgOutAlpha: 88,
      weatherBgColor: '#ffffff', weatherBgAlpha: 44, weatherBlur: 3,
      sceneOverlayColor: '#c98a80', sceneOverlayAlpha: 10,
      badgeColor: '#b3403f', dramaColor: '#a03230', dramaBgAlpha: 13,
      interceptColor: '#7a6a52', interceptBgAlpha: 13,
      nsfwColor: '#a3505c', nsfwBgAlpha: 15,
      clockColor: '#2e2622', backdropBlur: 3,
      fontMain: "'Noto Serif', serif", fontHeaders: "'Shippori Mincho', serif",
      fontDiary: "'Yuji Syuku', serif",
    },
  },
  {
    id: 'egypt', label: 'Древний Египет', icon: '𓂀', category: 'history',
    hint: 'Светлая: папирус, иероглифы и золото.',
    vars: {
      glassType: 'tinted',
      textColor: '#3a2c14', textMutedColor: '#6d5a33',
      accentColor: '#c9a227', glowColor: '#e8cf7a', glowAlpha: 34,
      cardBgStart: '#f6ecd2', cardBgEnd: '#eadcb8', cardBgAlpha: 92,
      infoBlockBgStart: '#fdf6e4', infoBlockBgEnd: '#f2e6c8', infoBlockBgAlpha: 62,
      memoryBgStart: '#f7eed6', memoryBgEnd: '#ebdeba', memoryBgAlpha: 90,
      memoryAccent: '#c9a227', memoryGlowAlpha: 20, memoryBlur: 4,
      topBarBg: '#e8d9ae', topBarAlpha: 66, tabsBg: '#f2e6c8', tabsAlpha: 56,
      phoneBgStart: '#f4e9cc', phoneBgEnd: '#e4d3a8', phoneBgAlpha: 94,
      phoneAccent: '#c9a227', phoneFrameColor: '#d2bb85', phoneScreenGlow: 16,
      msgInBg: '#ffffff', msgInAlpha: 72,
      msgOutStart: '#d8b74a', msgOutEnd: '#e8d38a', msgOutAlpha: 88,
      weatherBgColor: '#ffffff', weatherBgAlpha: 42, weatherBlur: 3,
      sceneOverlayColor: '#c9a227', sceneOverlayAlpha: 10,
      badgeColor: '#1e6f8c', dramaColor: '#1e6f8c', dramaBgAlpha: 14,
      interceptColor: '#8a6a2a', interceptBgAlpha: 13,
      nsfwColor: '#a8582a', nsfwBgAlpha: 15,
      clockColor: '#3a2c14', backdropBlur: 3,
      fontMain: "'Noto Serif', serif", fontHeaders: "'Cinzel', serif",
      fontDiary: "'Marcellus', serif",
    },
  },
  {
    id: 'western', label: 'Вестерн', icon: '🤠', category: 'history',
    hint: 'Светлая: выгоревшее дерево, пыль и револьверная сталь.',
    vars: {
      glassType: 'clear',
      textColor: '#3b2a1c', textMutedColor: '#6d5540',
      accentColor: '#b06a2c', glowColor: '#d8a05a', glowAlpha: 30,
      cardBgStart: '#f3e6d2', cardBgEnd: '#e5d2b6', cardBgAlpha: 92,
      infoBlockBgStart: '#fbf2e4', infoBlockBgEnd: '#efdfc6', infoBlockBgAlpha: 62,
      memoryBgStart: '#f5e8d6', memoryBgEnd: '#e7d5b8', memoryBgAlpha: 90,
      memoryAccent: '#b06a2c', memoryGlowAlpha: 18, memoryBlur: 4,
      topBarBg: '#e3cfae', topBarAlpha: 66, tabsBg: '#efdfc6', tabsAlpha: 56,
      phoneBgStart: '#f0e2cc', phoneBgEnd: '#dfc9a6', phoneBgAlpha: 94,
      phoneAccent: '#b06a2c', phoneFrameColor: '#c9ab80', phoneScreenGlow: 14,
      msgInBg: '#ffffff', msgInAlpha: 72,
      msgOutStart: '#c98a4a', msgOutEnd: '#e0b183', msgOutAlpha: 88,
      weatherBgColor: '#ffffff', weatherBgAlpha: 42, weatherBlur: 3,
      sceneOverlayColor: '#b06a2c', sceneOverlayAlpha: 12,
      badgeColor: '#a33a2a', dramaColor: '#a33a2a', dramaBgAlpha: 14,
      interceptColor: '#7a5a3a', interceptBgAlpha: 13,
      nsfwColor: '#9c4a3a', nsfwBgAlpha: 15,
      clockColor: '#3b2a1c', backdropBlur: 3,
      fontMain: "'Alice', serif", fontHeaders: "'Rye', cursive",
      fontDiary: "'Special Elite', cursive",
    },
  },
  {
    id: 'pirate', label: 'Пираты', icon: '🏴‍☠️', category: 'history',
    hint: 'Светлая: пергамент, ром и морские карты.',
    vars: {
      glassType: 'tinted',
      textColor: '#33261a', textMutedColor: '#63503c',
      accentColor: '#8a5a2a', glowColor: '#c9a06a', glowAlpha: 30,
      cardBgStart: '#f2e4cc', cardBgEnd: '#e3d0ae', cardBgAlpha: 92,
      infoBlockBgStart: '#fbf1dd', infoBlockBgEnd: '#eeddc0', infoBlockBgAlpha: 62,
      memoryBgStart: '#f4e6d0', memoryBgEnd: '#e5d2b2', memoryBgAlpha: 90,
      memoryAccent: '#8a5a2a', memoryGlowAlpha: 18, memoryBlur: 4,
      topBarBg: '#e0cba6', topBarAlpha: 66, tabsBg: '#eeddc0', tabsAlpha: 56,
      phoneBgStart: '#eee0c6', phoneBgEnd: '#dcc59e', phoneBgAlpha: 94,
      phoneAccent: '#8a5a2a', phoneFrameColor: '#c2a578', phoneScreenGlow: 14,
      msgInBg: '#ffffff', msgInAlpha: 72,
      msgOutStart: '#b08048', msgOutEnd: '#d4ab74', msgOutAlpha: 88,
      weatherBgColor: '#ffffff', weatherBgAlpha: 42, weatherBlur: 3,
      sceneOverlayColor: '#8a5a2a', sceneOverlayAlpha: 12,
      badgeColor: '#8c2a2a', dramaColor: '#8c2a2a', dramaBgAlpha: 14,
      interceptColor: '#5a6a4a', interceptBgAlpha: 13,
      nsfwColor: '#8a4a3a', nsfwBgAlpha: 15,
      clockColor: '#33261a', backdropBlur: 3,
      fontMain: "'Alice', serif", fontHeaders: "'Pirata One', cursive",
      fontDiary: "'IM Fell English', serif",
    },
  },
  {
    id: 'witch', label: 'Ведьмовство', icon: '🕯️', category: 'mystic',
    hint: 'Свечи, травы и меловые символы. Тёплая тьма с восковым светом.',
    vars: {
      glassType: 'tinted',
      accentColor: '#c8a86a', glowColor: '#6a4a8a', glowAlpha: 38,
      cardBgStart: '#1d1726', cardBgEnd: '#110c17', cardBgAlpha: 58,
      infoBlockBgStart: '#261e33', infoBlockBgEnd: '#150f1e', infoBlockBgAlpha: 34,
      memoryBgStart: '#1f1828', memoryBgEnd: '#120d19', memoryBgAlpha: 46,
      memoryAccent: '#c8a86a', memoryGlowAlpha: 26, memoryBlur: 10,
      topBarBg: '#1a1422', topBarAlpha: 62, tabsBg: '#130e1a', tabsAlpha: 46,
      phoneBgStart: '#1d1726', phoneBgEnd: '#0f0b15', phoneBgAlpha: 94,
      phoneAccent: '#c8a86a', phoneFrameColor: '#2c2238', phoneScreenGlow: 30,
      msgInBg: '#e8d8b0', msgInAlpha: 12,
      msgOutStart: '#6a4a8a', msgOutEnd: '#372549', msgOutAlpha: 86,
      weatherBgColor: '#1a1422', weatherBgAlpha: 52, weatherBlur: 10,
      sceneOverlayColor: '#6a4a8a', sceneOverlayAlpha: 16,
      badgeColor: '#b8703a', dramaColor: '#b8703a', dramaBgAlpha: 16,
      interceptColor: '#8a6ab0', interceptBgAlpha: 15,
      nsfwColor: '#9a5a7a', nsfwBgAlpha: 18,
      clockColor: '#f0dcb0', backdropBlur: 10,
      fontMain: "'Alice', serif", fontHeaders: "'Cormorant Garamond', serif",
      fontDiary: "'Bad Script', cursive",
    },
  },
  {
    id: 'voodoo', label: 'Вуду', icon: '🧿', category: 'mystic',
    hint: 'Куклы, амулеты и тёмная зелень. Ржавый багрянец по болотному.',
    vars: {
      glassType: 'tinted',
      accentColor: '#c2543a', glowColor: '#2e5a3a', glowAlpha: 36,
      cardBgStart: '#152018', cardBgEnd: '#0b120d', cardBgAlpha: 58,
      infoBlockBgStart: '#1d2c20', infoBlockBgEnd: '#101a12', infoBlockBgAlpha: 34,
      memoryBgStart: '#16221a', memoryBgEnd: '#0c130e', memoryBgAlpha: 46,
      memoryAccent: '#c2543a', memoryGlowAlpha: 24, memoryBlur: 9,
      topBarBg: '#131e16', topBarAlpha: 62, tabsBg: '#0d150f', tabsAlpha: 46,
      phoneBgStart: '#152018', phoneBgEnd: '#0a110c', phoneBgAlpha: 94,
      phoneAccent: '#c2543a', phoneFrameColor: '#243424', phoneScreenGlow: 26,
      msgInBg: '#d8e8c8', msgInAlpha: 11,
      msgOutStart: '#5a3a2a', msgOutEnd: '#2e1d15', msgOutAlpha: 86,
      weatherBgColor: '#131e16', weatherBgAlpha: 52, weatherBlur: 9,
      sceneOverlayColor: '#2e5a3a', sceneOverlayAlpha: 18,
      badgeColor: '#c2543a', dramaColor: '#c2543a', dramaBgAlpha: 17,
      interceptColor: '#7a9a5a', interceptBgAlpha: 15,
      nsfwColor: '#8a4a3a', nsfwBgAlpha: 18,
      clockColor: '#e0d0a8', backdropBlur: 9,
      fontMain: "'Alice', serif", fontHeaders: "'Metamorphous', cursive",
      fontDiary: "'Shadows Into Light', cursive",
    },
  },
  {
    id: 'spacehorror', label: 'Космохоррор', icon: '🛸', category: 'space',
    hint: 'Мёртвый корабль: тьма, аварийные лампы и красный отсвет.',
    vars: {
      glassType: 'clear',
      accentColor: '#e03a3a', glowColor: '#7a1414', glowAlpha: 34,
      cardBgStart: '#0d1113', cardBgEnd: '#05080a', cardBgAlpha: 64,
      infoBlockBgStart: '#141a1d', infoBlockBgEnd: '#080c0e', infoBlockBgAlpha: 36,
      memoryBgStart: '#0e1315', memoryBgEnd: '#06090b', memoryBgAlpha: 50,
      memoryAccent: '#e03a3a', memoryGlowAlpha: 22, memoryBlur: 6,
      topBarBg: '#0b0f11', topBarAlpha: 68, tabsBg: '#070a0c', tabsAlpha: 52,
      phoneBgStart: '#0d1113', phoneBgEnd: '#040708', phoneBgAlpha: 96,
      phoneAccent: '#e03a3a', phoneFrameColor: '#1a2124', phoneScreenGlow: 20,
      msgInBg: '#b8c8d0', msgInAlpha: 10,
      msgOutStart: '#7a1414', msgOutEnd: '#3a0a0a', msgOutAlpha: 88,
      weatherBgColor: '#0b0f11', weatherBgAlpha: 58, weatherBlur: 5,
      sceneOverlayColor: '#7a1414', sceneOverlayAlpha: 16,
      badgeColor: '#e03a3a', dramaColor: '#e03a3a', dramaBgAlpha: 18,
      interceptColor: '#5a8a9a', interceptBgAlpha: 14,
      nsfwColor: '#8a2a3a', nsfwBgAlpha: 17,
      clockColor: '#d8e4e8', backdropBlur: 5,
      fontMain: "'Exo 2', sans-serif", fontHeaders: "'Share Tech Mono', monospace",
      fontDiary: "'Share Tech Mono', monospace",
    },
  },
];


// Наборы тем. Пользователь может спрятать целые категории, чтобы ряд
// пресетов не разрастался: двадцать с лишним кнопок листать неудобно.
export const THEME_CATEGORIES = [
  { id: 'classic', label: 'Классика' },
  { id: 'cozy', label: 'Уют' },
  { id: 'mystic', label: 'Мистика' },
  { id: 'punk', label: 'Панк' },
  { id: 'history', label: 'История' },
  { id: 'space', label: 'Космос' },
  { id: 'nature', label: 'Стихии' },
];
const HUD_THEME_IDS = HUD_THEMES.map(t => t.id);

// Все поля, которыми вообще распоряжаются темы. Нужен и для сброса, и для
// снимка своей темы: перечислять руками — верный способ что-то забыть.
export const THEME_KEYS = [...new Set(HUD_THEMES.flatMap(t => Object.keys(t.vars)))];

// Реестр вместе с сохранённой пользователем темой, если она есть.
function allThemes() {
  const list = HUD_THEMES.slice();
  const own = settings.customTheme;
  if (own && own.vars && Object.keys(own.vars).length) {
    list.push({
      id: 'custom', label: own.label || 'Своя', icon: own.icon || '\u2605',
      hint: 'Ваша сохранённая тема', vars: own.vars, custom: true,
    });
  }
  return list;
}

export function getTheme(id) {
  return allThemes().find(t => t.id === id) || null;
}

// Значения темы вместе с правками пользователя поверх неё.
export function themeVars(id) {
  const t = getTheme(id);
  if (!t) return null;
  const edits = (settings.themeEdits && settings.themeEdits[id]) || {};
  return Object.assign({}, t.vars, edits);
}

// Ряд кнопок пресетов. Живёт здесь, а не в index.js, потому что его
// приходится перерисовывать и после сохранения своей темы.
// Какие наборы показывать. Пустая настройка означает «все»: не заставлять же
// пользователя отмечать галочки, чтобы просто увидеть темы.
export function visibleThemes() {
  const набор = settings.themePacks;
  const все = allThemes();
  if (!набор || typeof набор !== 'object') return все;
  const выключенные = Object.keys(набор).filter(k => набор[k] === false);
  if (!выключенные.length) return все;
  // Свою тему не прячем никогда: она одна и сделана руками.
  return все.filter(t => t.custom || !выключенные.includes(t.category || 'classic'));
}

export function presetRowHTML(activeId) {
  const btn = (t) => `<button type="button" class="hud-theme-preset${activeId === t.id ? ' active' : ''}${t.custom ? ' own' : ''}` +
    `" data-theme-preset="${t.id}" title="${String(t.hint).replace(/"/g, '&quot;')}">` +
    `<span>${t.icon}</span><small>${String(t.label).replace(/</g, '&lt;')}</small></button>`;
  return visibleThemes().map(btn).join('') +
    `<button type="button" class="hud-theme-preset reset${activeId ? '' : ' active'}" data-theme-preset=""` +
    ` title="Вернуть стандартные цвета TavernOS"><span>\u21BA</span><small>Сброс</small></button>`;
}

// Тема как файл: снимок текущих значений и разбор чужого файла. Формат
// простой и читаемый — его можно править руками и переслать кому угодно.
export function themeSnapshot(label) {
  const vars = {};
  for (const k of THEME_KEYS) if (settings[k] !== undefined) vars[k] = settings[k];
  return {
    format: 'tavernos-theme', version: 1,
    label: String(label || 'Своя тема'),
    icon: (settings.customTheme && settings.customTheme.icon) || '\u2605',
    vars,
  };
}

// Разбор входящего файла. Чужому файлу не доверяем: берём только знакомые
// ключи и только простые значения — строку или число. Иначе тема стала бы
// способом протащить в настройки что угодно.
export function parseThemeFile(text) {
  let данные;
  try { данные = JSON.parse(String(text || '')); } catch (_) { return null; }
  if (!данные || typeof данные !== 'object') return null;
  const источник = данные.vars && typeof данные.vars === 'object' ? данные.vars : данные;
  const vars = {};
  for (const k of THEME_KEYS) {
    const v = источник[k];
    if (typeof v === 'string' && v.length <= 120) vars[k] = v;
    else if (typeof v === 'number' && Number.isFinite(v)) vars[k] = v;
  }
  if (!Object.keys(vars).length) return null;
  return {
    label: typeof данные.label === 'string' ? данные.label.slice(0, 40) : 'Тема из файла',
    icon: typeof данные.icon === 'string' ? данные.icon.slice(0, 4) : '\u2605',
    vars,
  };
}

// Класс темы вешаем на <html>: правила вида :root.hud-theme-medieval
// перебивают обычный :root, где живут переменные HUD.
export function applyThemeClass(id) {
  const root = document.documentElement;
  if (!root) return;
  HUD_THEME_IDS.forEach(t => root.classList.remove('hud-theme-' + t));
  if (id && HUD_THEME_IDS.includes(id)) root.classList.add('hud-theme-' + id);
}
