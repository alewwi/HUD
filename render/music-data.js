// hud-manager/render/music-data.js
//
// Где лежит подборка музыки хода (render/music.js) и её краткая форма для
// летописи (chronicle.js) и архива (history-analyzer.js).
//
// Отдельным модулем, потому что подборку читают и музыка, и летопись, и
// архив: музыка сама пополняет летопись, и общий код в любом из них замкнул
// бы импорты в круг.
//
// Подборка — в message.extra.hud_music, у каждого свайпа своя: extra
// SillyTavern переносит в swipe_info и обратно, как версии HUD.

export const номерСвайпа = (m) => (m && Number.isInteger(m.swipe_id) ? m.swipe_id : 0);

/** Подборка текущего свайпа сообщения или null. */
export function музыкаХода(message) {
  if (!message || typeof message !== 'object') return null;
  const sid = номерСвайпа(message);
  const годится = (m) => m && typeof m === 'object' && (m.swipe ?? 0) === sid && (Array.isArray(m.soundtrack) || m.scene) ? m : null;
  return годится(message.extra && message.extra.hud_music)
    || годится(Array.isArray(message.swipe_info) && message.swipe_info[sid] && message.swipe_info[sid].extra && message.swipe_info[sid].extra.hud_music);
}

export function сохранитьМузыку(message, музыка) {
  if (!message.extra || typeof message.extra !== 'object') message.extra = {};
  message.extra.hud_music = музыка;
  const свайп = Array.isArray(message.swipe_info) ? message.swipe_info[номерСвайпа(message)] : null;
  if (свайп && typeof свайп === 'object') {
    if (!свайп.extra || typeof свайп.extra !== 'object') свайп.extra = {};
    свайп.extra.hud_music = музыка;
  }
}

// Трек в летописи: имя, название, обложка; ok — только «не найден».
// Ссылки на каталог и пояснения не храним: они длинные, а архиву не нужны.
const трекКратко = (т) => {
  if (!т || !т.a || !т.t) return null;
  const о = { a: String(т.a), t: String(т.t) };
  if (т.art) о.art = String(т.art);
  if (т.ok === false) о.ok = false;
  return о;
};
const треки = (список, n) => (Array.isArray(список) ? список : []).map(трекКратко).filter(Boolean).slice(0, n);

/**
 * Краткая подборка для летописи: метка, повод, саундтрек, музыка в сцене и в
 * телефоне. Та же сцена — та же краткая форма, и летопись, хранящая только
 * изменения, не повторяет её из хода в ход.
 */
export function музыкаДляЛетописи(м) {
  if (!м || typeof м !== 'object') return null;
  const о = { label: String(м.label || ''), soundtrack: треки(м.soundtrack, 12) };
  if (м.why) о.why = String(м.why);
  const сц = м.scene && треки(м.scene.tracks, 4);
  if (сц && сц.length) о.scene = { src: String(м.scene.src || ''), tracks: сц };
  const тел = м.phone && треки(м.phone.tracks, 8);
  if (тел && тел.length) о.phone = { owner: String(м.phone.owner || ''), tracks: тел };
  return о.soundtrack.length || о.scene || о.phone ? о : null;
}
