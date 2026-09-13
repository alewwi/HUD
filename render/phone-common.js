// hud-manager/render/phone-common.js
//
// Мелочь, которую делят телефон и мессенджер: кружок собеседника, время
// сообщения и сбор собеседников по строкам переписки. Лежит отдельно,
// чтобы ни один из двух модулей не пришлось объявлять главным.

import { escapeHtml } from '../utils.js?v=22.99.4';
import { overrideAvatarUrl } from '../avatars.js?v=22.99.4';
import { namesLikelySame } from '../names.js?v=22.99.4';

// Обращения без адресата: такие имена в собеседники не годятся.
const GENERIC_PARTY = /^(все|всем|all|everyone|группа|group|чат|chat|вы|you|user|я|me)$/i;

// Кружок собеседника. Если для имени назначена ручная аватарка, подставляем
// её фоном прямо в существующий элемент: разметка и классы не меняются, а
// буква прячется классом has-img. Иначе — прежний кружок с инициалом.
// Буква остаётся в разметке всегда — при фотографии её прячет класс
// has-img (color: transparent). Благодаря этому аватарку можно поменять
// прямо на месте, не пересобирая блок: см. refreshAvatarFaces.
// Время сообщения живёт в отдельном поле после «|», а если полей нет — в
// самом хвосте строки, перед отметкой о доставке. Искать первое попавшееся
// «ч:мм» по всему сообщению нельзя: во фразе «Приезжай к 8:00 … | 22:02»
// первым найдётся 8:00 из текста письма, а не время отправки.
export function msgTimeOf(raw) {
  const s = String(raw || '');
  const ONLY_TIME = /^(?:Вчера|Сегодня|Завтра)?[,\s]*\d{1,2}:\d{2}$/i;
  const parts = s.split('|').map(x => x.trim());
  if (parts.length > 1) {
    const field = parts.slice(1).find(x => ONLY_TIME.test(x));
    if (field) return (field.match(/\d{1,2}:\d{2}/) || [''])[0];
  }
  // Полей нет — смотрим хвост: «…текст 22:02 ✓».
  const tail = s.match(/(?:\b(?:Вчера|Сегодня|Завтра)[,\s]*)?\b(\d{1,2}:\d{2})\s*(?:✓+|read|unread|доставлен[а-я]*|прочитан[а-я]*|отправлен[а-я]*|draft|черновик)?\s*$/i);
  return tail ? tail[1] : '';
}
export function avaFace(name, cls, fallbackBg, inner) {
  const url = overrideAvatarUrl(name);
  const letter = String(name || '').trim().charAt(0).toUpperCase() || '?';
  const bg = fallbackBg && fallbackBg !== 'transparent' ? fallbackBg : 'none';
  return `<span class="${cls}${url ? ' has-img' : ''}" data-ava-name="${escapeHtml(String(name || ''))}` +
    `" data-ava-bg="${escapeHtml(bg)}" style="background-image:${url ? `url('${url}')` : bg}"` +
    `>${escapeHtml(letter)}${inner || ''}</span>`;
}
// Все реальные участники переписки, кроме владельца телефона.
// Имена схлопываются нечётко: «Тристан», «Tristan» и «Tristan Kingsley» — один человек.
export function collectCounterparts(messages, owner) {
  const seen = [];
  (Array.isArray(messages) ? messages : []).forEach(msgStr => {
    const { sender, recipient } = parseMsgParties(msgStr);
    [sender, recipient].forEach(n => {
      if (!n || GENERIC_PARTY.test(n)) return;
      if (owner && namesLikelySame(n, owner)) return;
      if (seen.some(s => namesLikelySame(s, n))) return;
      seen.push(n);
    });
  });
  return seen;
}

// Разбор «Кто -> Кому: текст» из одной строки сообщения.
// Нужен и рендеру, и определению собеседника, поэтому вынесен наверх.
export function parseMsgParties(msgStr) {
  const main = String(msgStr).split('|')[0].replace(/^(?:M|Msg|Сообщение|Chat|Чат):\s*/i, '').trim();
  const m = main.match(/^([^:-]+?)(?:\s*(?:->|→)\s*([^:]+))?:\s*(.*)$/);
  if (!m) return { sender: '', recipient: '' };
  return { sender: (m[1] || '').trim(), recipient: (m[2] || '').trim() };
}
