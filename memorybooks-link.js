// hud-manager/memorybooks-link.js
//
// MemoryBooks (расширение памяти в лорбук) собирает сцену прямо из текста
// сообщений — вместе с полными блоками HUD, а это около двух третей текста.
// Размер сцены он считает сам, до отправки, и длинную сцену отклоняет по
// порогу, хотя в запрос HUD всё равно уходит одной сводкой (index.js, безHUD).
//
// Обход без правки MemoryBooks: у него есть свои «исходящие» правила regex
// Таверны — выбранные правила он применяет к промту ДО подсчёта, причём и
// выключенные (включает их только на время своего запроса). HUD заводит
// такое правило выключенным — чат и промты Таверны оно не трогает — и
// отмечает его в настройках MemoryBooks. Правило ставит на место блока
// маркер [HUD_REF]; когда запрос MemoryBooks уходит, HUD находит по тексту
// перед маркером, из какого сообщения был блок, и ставит на его место сводку
// [HUD_SUMMARY] (дата, время, место, люди, одежда).
//
// Правила MemoryBooks помнит по номеру в общем списке Таверны («idx:N»),
// глобальные — первыми. Номер сдвигается, если удалить правило выше, — при
// загрузке HUD сверяет и поправляет отметку (сверитьСMemoryBooks).

import { hudБлоки } from './hud-block.js?v=23.84.1';

export const МЕТКА_HUD = '[HUD_REF]';
const ID_ПРАВИЛА = 'tavernos-hud-memorybooks';
export const ИМЯ_ПРАВИЛА = 'TavernOS HUD · блоки HUD для MemoryBooks (не включать)';

/** Правило regex Таверны: полный блок HUD → маркер. Выключено всегда. */
export function правилоHUD() {
  return {
    id: ID_ПРАВИЛА,
    scriptName: ИМЯ_ПРАВИЛА,
    // Блок — только [HUD], за которым сразу данные ({ или ```json): модель
    // упоминает «[HUD]» и в рассуждениях (<plan>), и правило попроще съедало
    // всё от такого упоминания до настоящего [/HUD] вместе с текстом ответа.
    findRegex: '/\\[HUD\\]\\s*(?:```[a-zA-Z]*\\s*)?\\{[\\s\\S]*?\\[\\/HUD\\]/g',
    replaceString: МЕТКА_HUD,
    trimStrings: [],
    // Без места применения: даже если правило включить, Таверна его никуда
    // не применит (и не сотрёт HUD из ответов). MemoryBooks место не смотрит.
    placement: [],
    disabled: true,
    markdownOnly: false,
    promptOnly: false,
    runOnEdit: false,
    substituteRegex: 0,
    minDepth: null,
    maxDepth: null,
  };
}

const настройкиMB = (ext) => (ext && ext.STMemoryBooks && typeof ext.STMemoryBooks === 'object' ? ext.STMemoryBooks : null);

/** Что сейчас: есть ли MemoryBooks, правило и его отметка. */
export function состояниеСвязи(ext) {
  const глобальные = Array.isArray(ext && ext.regex) ? ext.regex : [];
  const индекс = глобальные.findIndex(п => п && п.id === ID_ПРАВИЛА);
  const mb = настройкиMB(ext);
  const выбраны = mb && mb.moduleSettings && Array.isArray(mb.moduleSettings.selectedRegexOutgoing) ? mb.moduleSettings.selectedRegexOutgoing : [];
  return {
    естьMemoryBooks: !!mb,
    правилоЕсть: индекс >= 0,
    индекс,
    отмечено: индекс >= 0 && выбраны.includes('idx:' + индекс),
    regexВключён: !!(mb && mb.moduleSettings && mb.moduleSettings.useRegex),
  };
}

/**
 * Завести правило (если нет), держать его выключенным и отметить в MemoryBooks.
 * прошлыйКлюч — отметка, которую HUD ставил раньше: если номер сдвинулся,
 * старую снимаем, чтобы MemoryBooks не применял чужое правило.
 * Возвращает новый ключ («idx:N») или '' — MemoryBooks нет.
 */
export function подключитьMemoryBooks(ext, прошлыйКлюч = '') {
  if (!ext) return '';
  if (!Array.isArray(ext.regex)) ext.regex = [];
  let индекс = ext.regex.findIndex(п => п && п.id === ID_ПРАВИЛА);
  if (индекс < 0) { ext.regex.push(правилоHUD()); индекс = ext.regex.length - 1; }
  else Object.assign(ext.regex[индекс], { disabled: true, placement: [], findRegex: правилоHUD().findRegex, replaceString: МЕТКА_HUD });
  const mb = настройкиMB(ext);
  if (!mb) return '';
  mb.moduleSettings = mb.moduleSettings || {};
  const ключ = 'idx:' + индекс;
  const выбраны = Array.isArray(mb.moduleSettings.selectedRegexOutgoing) ? mb.moduleSettings.selectedRegexOutgoing.slice() : [];
  const без = прошлыйКлюч && прошлыйКлюч !== ключ ? выбраны.filter(к => к !== прошлыйКлюч) : выбраны;
  if (!без.includes(ключ)) без.push(ключ);
  mb.moduleSettings.selectedRegexOutgoing = без;
  mb.moduleSettings.useRegex = true;
  return ключ;
}

/** Снять отметку в MemoryBooks и убрать правило. Прочие правила не трогаем. */
export function отключитьMemoryBooks(ext, прошлыйКлюч = '') {
  if (!ext) return;
  const глобальные = Array.isArray(ext.regex) ? ext.regex : [];
  const индекс = глобальные.findIndex(п => п && п.id === ID_ПРАВИЛА);
  const mb = настройкиMB(ext);
  if (mb && mb.moduleSettings && Array.isArray(mb.moduleSettings.selectedRegexOutgoing)) {
    const снять = new Set([прошлыйКлюч, индекс >= 0 ? 'idx:' + индекс : ''].filter(Boolean));
    // Правило уходит из списка — номера ниже него сдвигаются на один вверх.
    mb.moduleSettings.selectedRegexOutgoing = mb.moduleSettings.selectedRegexOutgoing
      .filter(к => !снять.has(к))
      .map(к => { const n = Number(String(к).replace(/^idx:/, '')); return индекс >= 0 && Number.isInteger(n) && n > индекс ? 'idx:' + (n - 1) : к; });
  }
  if (индекс >= 0) глобальные.splice(индекс, 1);
}

// --- Маркеры → сводки ---------------------------------------------------------
const норма = (s) => String(s ?? '').replace(/[​-‍⁠﻿]/g, '').replace(/[ ⠀　 -   ]/g, ' ').replace(/\s+/g, ' ').trim();
const ДЛИНА_СЛЕДА = 80;
const КОРОТКИЙ_СЛЕД = 12;

/**
 * Текст запроса с маркерами [HUD_REF] — на месте каждого сводка блока, из
 * которого он сделан. Блок ищем по тексту перед маркером: он совпадает с
 * концом текста сообщения перед его блоком HUD. Не нашли — маркер убираем.
 * замена(блок, прошлыйБлок) → строка сводки.
 */
export function сводкиВместоМеток(текст, чат, замена) {
  const s = String(текст ?? '');
  if (!s.includes(МЕТКА_HUD)) return s;
  // Кандидаты: каждый блок HUD чата и нормализованный текст перед ним.
  const блоки = [];
  (Array.isArray(чат) ? чат : []).forEach((m, i) => {
    const mes = String((m && (m.mes ?? m.message)) || '');
    if (!mes.includes('[HUD]')) return;
    for (const б of hudБлоки(mes)) блоки.push({ i, полный: б.full, перед: норма(mes.slice(0, б.index)) });
  });
  const куски = s.split(МЕТКА_HUD);
  let out = куски[0], прошлый = '', с = 0;
  for (let k = 1; k < куски.length; k++) {
    const след = норма(куски[k - 1]).slice(-ДЛИНА_СЛЕДА);
    let найден = null;
    if (след.length >= КОРОТКИЙ_СЛЕД) {
      // Сначала после прошлого найденного — сцена идёт по порядку чата.
      for (let n = 0; n < блоки.length && !найден; n++) {
        const б = блоки[(с + n) % блоки.length];
        // Текст перед блоком в сообщении бывает короче следа (HUD почти в
        // начале) — тогда след кончается им.
        const совпало = б.перед.endsWith(след) || (б.перед.length >= КОРОТКИЙ_СЛЕД && б.перед.length < след.length && след.endsWith(б.перед));
        if (совпало) { найден = б; с = (с + n + 1) % блоки.length; }
      }
    }
    let вместо = '';
    if (найден) {
      try { вместо = String(замена(найден.полный, прошлый) || ''); } catch (_) { вместо = ''; }
      прошлый = найден.полный;
    }
    out += (вместо ? '\n' + вместо + '\n' : '') + куски[k];
  }
  return out.replace(/\n{3,}/g, '\n\n');
}
