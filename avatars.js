// hud-manager/avatars.js
//
// Разрешение URL аватарок персонажа и юзера + кэш. Самодостаточный модуль:
// зависит только от DOM и глобалей SillyTavern. Вынесено из index.js без
// изменения поведения.

// Кэш аватарок по имени персонажа: поиск идёт назад по ВСЕМ .mes в чате (нужно найти
// самое свежее упоминание имени), в длинном чате это дорогая операция, а вызывается она
// на каждый рендер карточки HUD. Кэшируем результат и сбрасываем его только когда в чат
// реально добавляются новые сообщения (см. invalidateAvatarCache()).
// Ручные аватарки читаются прямо из настроек: модуль и так знает про DOM
// и глобали SillyTavern, ещё одна зависимость ничего не усложняет.
import { settings } from './settings.js?v=22.70.10';

/** Палитра для плейсхолдеров аватарок: цвет выбирается по хэшу имени. */
export const HUD_AVATAR_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#22d3ee', '#a3e635'];

let avatarUrlCache = {};
export function invalidateAvatarCache() { avatarUrlCache = {}; }

// --- Ручные аватарки -------------------------------------------------------
// Нормализация имени для сравнения: регистр, ё/е и лишние пробелы не должны
// мешать совпадению «Арес Бомонт» и «арес  бомонт».
function normName(s) {
  return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function namesOf(raw) {
  return String(raw || '').split(/[,;\n]/).map(normName).filter(Boolean);
}

// Совпадением считаем полное равенство ИЛИ равенство по первому слову:
// в чатах персонаж встречается и полным именем, и одним лишь именем.
function nameMatches(target, list) {
  const t = normName(target);
  if (!t) return false;
  const tFirst = t.split(' ')[0];
  return list.some(nm => nm === t || nm.split(' ')[0] === tFirst);
}

// Имя закреплено за {{char}}? Тогда никакой другой персонаж не должен
// получить его фото — и наоборот.
function isPinnedCharName(name) {
  const list = namesOf(settings.avatarCharNames);
  return list.length > 0 && nameMatches(name, list);
}

function hasPinnedCharNames() {
  return namesOf(settings.avatarCharNames).length > 0;
}

// URL вручную назначенной аватарки или null.
function isPinnedUserName(name) {
  const list = namesOf(settings.avatarUserNames);
  return list.length > 0 && nameMatches(name, list);
}

export function overrideAvatarUrl(name) {
  if (settings.avatarUserImg && isPinnedUserName(name)) return settings.avatarUserImg;
  if (settings.avatarCharImg && isPinnedCharName(name)) return settings.avatarCharImg;
  const list = Array.isArray(settings.avatarOverrides) ? settings.avatarOverrides : [];
  for (const entry of list) {
    if (!entry || !entry.img) continue;
    if (nameMatches(name, namesOf(entry.names))) return entry.img;
  }
  return null;
}

function resolveAvatarUrl(characterName, isPrimary) {
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
  // Если имена {{char}} закреплены вручную, а спрашивают не о нём —
  // фолбэк «взять аватарку из последнего сообщения бота» пропускаем: именно
  // он и приклеивал фото персонажа первому попавшемуся NPC.
  if (isPrimary && hasPinnedCharNames() && !isPinnedCharName(characterName)) return null;
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

// Обновление аватарок без перерисовки HUD.
//
// Перерисовать блок нельзя: при первом проходе исходный текст [HUD]...[/HUD]
// заменяется готовой разметкой, и во второй раз разбирать уже нечего —
// именно поэтому картинки менялись только после перезагрузки страницы.
// Поэтому правим сами кружки: у каждого есть data-ava-name с именем и
// data-ava-bg с исходной заливкой, так что вернуть всё назад тоже можно.
function swapBigAvatar(el, name, url) {
  const isImg = el.tagName === 'IMG';
  if (url) {
    if (isImg) { el.src = url; el.dataset.avaManual = '1'; return; }
    const img = document.createElement('img');
    img.className = el.className.replace('hud-avatar-placeholder', 'hud-avatar');
    img.src = url; img.alt = 'avatar';
    img.dataset.avaName = name; img.dataset.avaManual = '1';
    el.replaceWith(img);
    return;
  }
  // Ручную картинку убрали — возвращаем заглушку с инициалом.
  if (isImg && el.dataset.avaManual === '1') {
    const ph = document.createElement('div');
    ph.className = el.className.replace('hud-avatar', 'hud-avatar-placeholder');
    ph.dataset.avaName = name;
    ph.textContent = '👤';
    el.replaceWith(ph);
  }
}

export function refreshAvatarFaces(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-ava-name]').forEach(el => {
    const name = el.getAttribute('data-ava-name') || '';
    const url = el.getAttribute('data-ava-role') === 'user'
      ? (settings.avatarUserImg || getUserAvatarUrl())
      : overrideAvatarUrl(name);
    if (el.tagName === 'IMG' || el.classList.contains('hud-avatar-placeholder')) {
      swapBigAvatar(el, name, url);
      return;
    }
    if (url) {
      el.classList.add('has-img');
      el.style.backgroundImage = "url('" + url + "')";
    } else {
      el.classList.remove('has-img');
      el.style.backgroundImage = el.getAttribute('data-ava-bg') || 'none';
    }
  });
}

export function getAvatarUrl(characterName, isPrimary = false) {
  // Ручная аватарка идёт раньше кэша: её меняют в настройках, и результат
  // должен быть виден сразу, без перерисовки всего чата.
  const manual = overrideAvatarUrl(characterName);
  if (manual) return { url: manual, thumbUrl: manual };
  const searchName = (characterName || '').toLowerCase().trim();
  const cacheKey = searchName + '::' + (isPrimary ? '1' : '0');
  if (avatarUrlCache.hasOwnProperty(cacheKey)) return avatarUrlCache[cacheKey];
  const result = resolveAvatarUrl(characterName, isPrimary);
  avatarUrlCache[cacheKey] = result;
  return result;
}

export function getUserAvatarUrl() {
  // Закреплённая вручную аватарка игрока перекрывает автоопределение.
  if (settings.avatarUserImg) return settings.avatarUserImg;
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
