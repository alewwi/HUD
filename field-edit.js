// hud-manager/field-edit.js
//
// Правка одного поля или своего стата прямо в карточке (кнопка ✎ в шапке
// карточки → нажать на строку). Новое значение пишется в сам HUD сообщения —
// в кодах, как его пишет модель, — поэтому и карточка, и снимок для модели в
// следующем ходу видят уже исправленное. Прежний HUD уходит в версии «↶».
//
// Здесь — чистая часть: какое поле у строки, что показать в окошке и как
// подменить значение в объекте HUD. Кнопки и запись в чат — index.js.

import { mapKey } from './utils.js?v=23.88.92';
import { КАТАЛОГ } from './deep-fields.js?v=23.88.92';
import { namesLikelySame } from './names.js?v=23.88.92';

const объект = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const поляРаздела = (код) => (КАТАЛОГ.find(р => р.код === код) || { группы: [] }).группы.flatMap(г => г.поля.map(п => п[0]));

/** Код поля по data-k строки (имя поля в нижнем регистре); '' — не наше поле. */
export function кодПоля(кто, метка) {
  const м = String(метка || '').trim().toLowerCase();
  if (!м) return '';
  return поляРаздела(кто === 'user' ? 'us' : 'cs').find(к => mapKey(к).toLowerCase() === м || к.toLowerCase() === м) || '';
}

/** Значение поля текстом для окошка: список — через «; », объект — «метка: значение; …». */
export function значениеДляПравки(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map(значениеДляПравки).filter(Boolean).join('; ');
  if (объект(v)) return Object.entries(v).map(([к, з]) => `${к}: ${значениеДляПравки(з)}`).join('; ');
  const s = String(v);
  return /^(?:empty|none|null)$/i.test(s.trim()) ? '' : s;
}

/** Запись HUD, в которой лежит поле: персонаж по имени, игрок, корень (статы истории). */
export function записьВладельца(hud, кто) {
  if (!объект(hud)) return null;
  // У игрока записи может не быть (модель пропустила us) — заведём.
  if (кто === 'user') return объект(hud.us) ? hud.us : (hud.us = {});
  if (кто === 'story') return hud;
  const список = Array.isArray(hud.cs) ? hud.cs : объект(hud.cs) ? [hud.cs] : [];
  const имя = String(кто || '').trim();
  return список.find(c => объект(c) && String(c.N || '').trim() === имя)
    || список.find(c => объект(c) && c.N && namesLikelySame(String(c.N), имя)) || null;
}

/** Текущее значение для окошка. */
export function текущееЗначение(hud, { кто, код, стат }) {
  const з = записьВладельца(hud, кто);
  if (!з) return null;
  if (стат) {
    const свои = кто === 'story' ? з.cst : з.Cst;
    if (!объект(свои)) return '';
    const ключ = Object.keys(свои).find(к => к.trim().toLowerCase() === String(стат).trim().toLowerCase());
    return ключ === undefined ? '' : значениеДляПравки(свои[ключ]);
  }
  return код in з ? значениеДляПравки(з[код]) : '';
}

/**
 * Подменить значение в объекте HUD (в кодах). Пустое значение — 'empty', как
 * пишет модель. true — подменено; false — некуда (нет такой записи).
 */
export function применитьПравку(hud, { кто, код, стат, значение }) {
  const з = записьВладельца(hud, кто);
  if (!з) return false;
  const v = String(значение ?? '').trim() || 'empty';
  if (стат) {
    const поле = кто === 'story' ? 'cst' : 'Cst';
    if (!объект(з[поле])) з[поле] = {};
    const ключ = Object.keys(з[поле]).find(к => к.trim().toLowerCase() === String(стат).trim().toLowerCase());
    з[поле][ключ === undefined ? String(стат).trim() : ключ] = v;
    return true;
  }
  if (!код) return false;
  з[код] = v;
  return true;
}
