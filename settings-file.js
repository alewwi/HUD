// hud-manager/settings-file.js
//
// Настройки HUD одним файлом: основные, кастомизация, свои темы и статы,
// картинки. Чаты и записи HUD сюда не входят, они живут в самих чатах.
// Здесь только данные, без окон и страницы: кнопки — в settings-ui.js.

export const МЕТКА_ФАЙЛА = 'tavernos-hud-settings';

// След этого браузера, а не настройка: дату ставит сохранение, список
// картинок считает отправка на сервер.
const СЛУЖЕБНЫЕ = new Set(['savedAt', 'localOnly']);
const ЗАПРЕТНЫЕ = new Set(['__proto__', 'prototype', 'constructor']);
// Вид, который живёт вне настроек: граница окна кастомизации, свёрнутая сцена,
// виджеты архива.
export const МЕСТНЫЕ_КЛЮЧИ = ['hud-custom-split', 'hud-scene-compact', 'hud_archive_widgets'];

// Ключей в настройках HUD нет: они лежат в секретах Таверны. Это страховка на
// случай, если ключ вставят в поле с текстом или появится новое поле. Файл
// пересылают, поэтому такое в него не попадает, а при загрузке не принимается.
const СЕКРЕТНОЕ_ИМЯ = /api[_-]?key|secret[_-]?key|password|passwd|credential|cookie|bearer|token$/i;
const СЕКРЕТНОЕ_ЗНАЧЕНИЕ = [
  /\bsk-[A-Za-z0-9_-]{16,}/,                                   // OpenAI, Anthropic, OpenRouter, DeepSeek
  /\bAIza[0-9A-Za-z_-]{30,}/,                                  // Google
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,                              // GitHub
  /\bhf_[A-Za-z0-9]{20,}/,                                     // Hugging Face
  /\bbearer\s+[A-Za-z0-9._~+/-]{16,}/i,
  /\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]+/,                      // JWT
  /[?&](?:api[_-]?key|key|token|auth|access_token)=[^&\s"']{8,}/i, // ключ в адресе
  /\/\/[^/\s:@]+:[^/\s@]+@/,                                   // логин и пароль в адресе
];
export const секретноеИмя = (имя) => СЕКРЕТНОЕ_ИМЯ.test(String(имя));
// Картинка — base64, в нём случайно найдётся что угодно.
export const секретноеЗначение = (значение) => typeof значение === 'string' && !значение.startsWith('data:') && СЕКРЕТНОЕ_ЗНАЧЕНИЕ.some(re => re.test(значение));

/** Копия без секретов; пути убранного — в список. Значения в список не попадают. */
function вычистить(значение, путь, убрано) {
  if (Array.isArray(значение)) {
    return значение.map((х, i) => вычистить(х, `${путь}[${i}]`, убрано)).filter(х => х !== undefined);
  }
  if (значение && typeof значение === 'object') {
    const итог = {};
    for (const [к, х] of Object.entries(значение)) {
      const где = путь ? `${путь}.${к}` : к;
      if (ЗАПРЕТНЫЕ.has(к) || (секретноеИмя(к) && х !== '' && х !== null)) { убрано.push(где); continue; }
      const чистое = вычистить(х, где, убрано);
      if (чистое !== undefined) итог[к] = чистое;
    }
    return итог;
  }
  if (секретноеЗначение(значение)) { убрано.push(путь); return undefined; }
  return значение;
}

const копия = (значение) => JSON.parse(JSON.stringify(значение));
const вид = (значение) => Array.isArray(значение) ? 'array' : значение && typeof значение === 'object' ? 'object' : 'value';

export function собратьФайл(настройки, версия = '', { хранилище = null, дата = new Date() } = {}) {
  const убрано = [];
  const чистые = вычистить(копия(настройки), '', убрано);
  СЛУЖЕБНЫЕ.forEach(к => { delete чистые[к]; });
  const местные = {};
  for (const к of МЕСТНЫЕ_КЛЮЧИ) {
    try {
      const з = хранилище && хранилище.getItem(к);
      if (typeof з === 'string') местные[к] = з;
    } catch (_) { /* хранилище недоступно: файл соберётся и без этого */ }
  }
  return { format: МЕТКА_ФАЙЛА, version: String(версия || ''), exportedAt: дата.toISOString(), settings: чистые, local: местные, removed: убрано };
}

/**
 * Разбирает текст файла. Чужой файл — null. Поле не того вида (список вместо
 * числа) пропускаем: сломанный файл не должен ломать HUD.
 */
export function разобратьФайл(текст, образец = {}) {
  let файл;
  try { файл = JSON.parse(String(текст).replace(/^﻿/, '')); } catch (_) { return null; }
  if (!файл || вид(файл) !== 'object' || файл.format !== МЕТКА_ФАЙЛА || вид(файл.settings) !== 'object') return null;
  const настройки = {};
  const убрано = [];
  const чистые = вычистить(файл.settings, '', убрано);
  let пропущено = убрано.length;
  for (const [к, з] of Object.entries(чистые)) {
    if (СЛУЖЕБНЫЕ.has(к)) continue;
    const неТо = (к in образец && образец[к] !== null && вид(образец[к]) !== вид(з));
    if (неТо) { пропущено++; continue; }
    настройки[к] = з;
  }
  const местные = {};
  if (вид(файл.local) === 'object') for (const к of МЕСТНЫЕ_КЛЮЧИ) if (typeof файл.local[к] === 'string') местные[к] = файл.local[к];
  return { настройки, местные, пропущено, версия: String(файл.version || ''), дата: String(файл.exportedAt || '') };
}

/** Заменяет настройки на месте. Чего в файле нет — возвращается к значению по умолчанию. */
export function применитьНастройки(настройки, разбор, образец = {}) {
  for (const к of Object.keys(настройки)) {
    if (к in разбор.настройки || СЛУЖЕБНЫЕ.has(к)) continue;
    if (к in образец) настройки[к] = копия(образец[к]);
    else delete настройки[к];
  }
  for (const к of Object.keys(образец)) if (!(к in настройки)) настройки[к] = копия(образец[к]);
  Object.assign(настройки, копия(разбор.настройки));
  return настройки;
}
