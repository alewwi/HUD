// hud-manager/avatars.js
//
// Разрешение URL аватарок персонажа и юзера + кэш. Самодостаточный модуль:
// зависит только от DOM и глобалей SillyTavern. Вынесено из index.js без
// изменения поведения.

// Кэш аватарок по имени персонажа: поиск идёт назад по ВСЕМ .mes в чате (нужно найти
// самое свежее упоминание имени), в длинном чате это дорогая операция, а вызывается она
// на каждый рендер карточки HUD. Кэшируем результат и сбрасываем его только когда в чат
// реально добавляются новые сообщения (см. invalidateAvatarCache()).
/** Палитра для плейсхолдеров аватарок: цвет выбирается по хэшу имени. */
export const HUD_AVATAR_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#22d3ee', '#a3e635'];

let avatarUrlCache = {};
export function invalidateAvatarCache() { avatarUrlCache = {}; }

export function resolveAvatarUrl(characterName, isPrimary) {
  const searchName = (characterName || '').toLowerCase().trim();
  if (searchName) {
      const allMes = Array.from(document.querySelectorAll('.mes'));
      for (let i = allMes.length - 1; i >= 0; i--) {
          const mes = allMes[i]; const nameEl = mes.querySelector('.mes_name');
          if (nameEl && nameEl.textContent.trim().toLowerCase().includes(searchName.split(' ')[0])) {
              const img = mes.querySelector('.avatar img, .avatar_img');
              if (img) {
                  const src = img.src || (img.style && img.style.backgroundImage ? img.style.backgroundImage.replace(/url\(['"]?|['"]?\)/g, '') : null);
                  if (src && !src.includes('undefined') && !src.includes('none')) return { url: src, thumbUrl: src };
              }
          }
      }
  }
  if (isPrimary) {
      const botMsgs = Array.from(document.querySelectorAll('.mes:not([is_user="true"]):not([is_system="true"]) .avatar img'));
      if (botMsgs.length > 0) {
          const lastBotMsg = botMsgs[botMsgs.length - 1];
          if (lastBotMsg && lastBotMsg.src && !lastBotMsg.src.includes('undefined') && !lastBotMsg.src.includes('none')) return { url: lastBotMsg.src, thumbUrl: lastBotMsg.src };
      }
  }
  if (!window.characters || !Array.isArray(window.characters)) return null;
  let char = window.characters.find(c => c.name && c.name.toLowerCase().trim() === searchName);
  if (!char) char = window.characters.find(c => c.name && c.name.toLowerCase().includes(searchName));
  if (!char && searchName.length > 2) {
      const firstWord = searchName.split(' ')[0].replace(/[^a-zа-яё]/gi, '');
      if (firstWord) char = window.characters.find(c => c.name && c.name.toLowerCase().includes(firstWord));
  }
  if (!char && isPrimary && window.this_chid !== undefined) char = window.characters[window.this_chid];
  if (!char || !char.avatar || char.avatar === 'none') return null;

  let file = char.avatar;
  if (file.startsWith('http') || file.startsWith('data:')) return { url: file, thumbUrl: file };
  if (typeof window.getThumbnailUrl === 'function') return { url: window.getThumbnailUrl('avatar', file), thumbUrl: `/characters/${encodeURIComponent(file)}` };
  return { url: `/thumbnail?type=avatar&file=${encodeURIComponent(file)}`, thumbUrl: `/characters/${encodeURIComponent(file)}` };
}

export function getAvatarUrl(characterName, isPrimary = false) {
  const searchName = (characterName || '').toLowerCase().trim();
  const cacheKey = searchName + '::' + (isPrimary ? '1' : '0');
  if (avatarUrlCache.hasOwnProperty(cacheKey)) return avatarUrlCache[cacheKey];
  const result = resolveAvatarUrl(characterName, isPrimary);
  avatarUrlCache[cacheKey] = result;
  return result;
}

export function getUserAvatarUrl() {
  try {
      const selectors = ['#user_avatar_block .avatar.selected img', '#user_avatar_block .avatar_img.selected', '.selected_avatar img', '#avatar_img_me', '.mes[is_user="true"] .avatar img'];
      for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
              const src = el.src || (el.style && el.style.backgroundImage ? el.style.backgroundImage.replace(/url\(['"]?|['"]?\)/g, '') : null);
              if (src && src !== '' && !src.includes('undefined') && !src.includes('none')) return src;
          }
      }
      let file = window.user_avatar;
      if (!file && typeof window.getUserAvatar === 'function') file = window.getUserAvatar();
      if (file && file !== 'none') {
          if (file.startsWith('http') || file.startsWith('data:')) return file;
          if (typeof window.getThumbnailUrl === 'function') return window.getThumbnailUrl('user_avatar', file) || window.getThumbnailUrl('avatar', file);
          return `/User Avatars/${encodeURIComponent(file)}`;
      }
  } catch (e) {} return null;
}
