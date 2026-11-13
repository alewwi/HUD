// hud-manager/render/phone-common.js
//
// Мелочь, которую делят телефон и мессенджер: кружок собеседника, время
// сообщения и сбор собеседников по строкам переписки. Лежит отдельно,
// чтобы ни один из двух модулей не пришлось объявлять главным.

import { escapeHtml, defeatWI, инициалыИмени } from '../utils.js?v=23.89.17';
import { overrideAvatarUrl, фотоПоИмени } from '../avatars.js?v=23.89.17';
import { namesLikelySame } from '../names.js?v=23.89.17';
import { G_ICONS } from './icons.js?v=23.89.17';

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
  // Поле может нести и день: «Вчера, 22:30», «14.06.1347, 08:30» — дату
  // проставляет перенос с прошлых ходов. На экране остаются одни часы.
  const ONLY_TIME = /^(?:Вчера|Сегодня|Завтра|Позавчера|Yesterday|Today|Tomorrow)?[,\s]*(?:\d{1,2}[.\/-]\d{1,2}(?:[.\/-]\d{2,4})?)?[,\s]*\d{1,2}:\d{2}$/i;
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
  const letter = String(name || '').trim() ? инициалыИмени(name, 1) : '?';
  const bg = fallbackBg && fallbackBg !== 'transparent' ? fallbackBg : 'none';
  return `<span class="${cls}${url ? ' has-img' : ''}" data-ava-auto="1" data-ava-name="${escapeHtml(String(name || ''))}` +
    `" data-ava-bg="${escapeHtml(bg)}" style="background-image:${url ? `url('${url}')` : bg}"` +
    `>${escapeHtml(letter)}${inner || ''}</span>`;
}
// Контакт, записанный не своим именем: { сохранён, настоящее } или null.
// Ищем и по записи в телефоне, и по настоящему имени: чат или звонок модель
// может назвать любым из них, а на экране телефона всегда то, как сохранено.
const настоящееИмяЗаписи = (c) => { const v = String((c && c.realName) || '').trim(); return /^(?:empty|none|нет|пусто|unknown|n\/a|неизвест\S*|—|-)?$/i.test(v) ? '' : v; };
// Строже обычного сравнения имён: namesLikelySame считает «Эрик Вайс» и «Эрик
// Смит» одним человеком, и чужой чат подписался бы ложным именем. Полное имя —
// только целиком, одно слово — только если оно есть в настоящем имени.
const словаИмени = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').split(/\s+/).filter(Boolean);
const этоОнПоИмени = (настоящее, имя) => {
  const н = словаИмени(настоящее), и = словаИмени(имя);
  if (!н.length || !и.length) return false;
  return н.join(' ') === и.join(' ') || (и.length === 1 && н.includes(и[0])) || (н.length === 1 && и.includes(н[0]));
};
export function контактСНастоящимИменем(контакты, имя) {
  const список = (Array.isArray(контакты) ? контакты : []).filter(c => c && c.name);
  const ищем = String(имя || '').trim().toLowerCase();
  if (!ищем) return null;
  const точно = список.find(c => String(c.name).trim().toLowerCase() === ищем);
  const запись = точно || список.find(c => этоОнПоИмени(настоящееИмяЗаписи(c), имя));
  const настоящее = настоящееИмяЗаписи(запись);
  return настоящее && !namesLikelySame(настоящее, запись.name) ? { сохранён: String(запись.name).trim(), настоящее } : null;
}

// Отметка рядом с именем там, где нажатие занято (строка чата открывает чат).
export const меткаЛожногоИмени = () => `<span class="hud-fake-mark" title="Записан под ложным именем">${G_ICONS.mask}</span>`;
// Закрытая плашка: что имя ложное, видно сразу, кто это — только по нажатию.
export const ложноеИмяHTML = (личность) => `<details class="hud-fake-name" data-reveal="1"><summary>${G_ICONS.mask}<span>ложное имя</span></summary>`
  + `<span class="hud-phone-real">на деле: ${defeatWI(escapeHtml(личность.настоящее))}</span></details>`;

// Все реальные участники переписки, кроме владельца телефона.
// Имена схлопываются нечётко: «Дамиан», «Damian» и «Damian Hartley» — один человек.
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
  const m = main.match(/^([^:]+?)(?:\s*(?:->|→)\s*([^:]+))?:\s*(.*)$/);
  if (!m) return { sender: '', recipient: '' };
  return { sender: (m[1] || '').trim(), recipient: (m[2] || '').trim() };
}
