// hud-manager/render/bets.js
//
// Пари между персонажами (поле Bt): «с кем | ставка | на что | open/won/lost».
// Модель пишет ставку один раз — в карточку того, кто её сделал. HUD отражает
// её во второй карточке (со стороны соперника, с перевёрнутым итогом), так что
// пари видно у обоих спорщиков.
//
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

import { escapeHtml, flattenFieldValue, снятьЗаглушки } from '../utils.js?v=23.89.27';
import { namesLikelySame } from '../names.js?v=23.89.27';
import { раскрывашка } from './fold.js?v=23.89.27';

// Метка отражённой ставки: её написали в карточке соперника.
const ЗЕРКАЛО = '⇄ ';
const ИТОГ = { open: 'open', идёт: 'open', открыто: 'open', won: 'won', выиграл: 'won', выиграла: 'won', lost: 'lost', проиграл: 'lost', проиграла: 'lost' };
const НАОБОРОТ = { won: 'lost', lost: 'won', open: 'open' };

/** «Тристан | свой макларен | что Ховард не придёт | open» → { с, ставка, на, итог, отражено }. */
export function разобратьПари(строка) {
  let s = String(строка ?? '').trim();
  const отражено = s.startsWith(ЗЕРКАЛО);
  if (отражено) s = s.slice(ЗЕРКАЛО.length);
  const [с = '', ставка = '', на = '', итог = ''] = s.split('|').map(x => x.trim());
  if (!с && !ставка && !на) return null;
  return { с, ставка, на, итог: ИТОГ[итог.toLowerCase()] || 'open', отражено };
}
const списокПари = (v) => снятьЗаглушки(flattenFieldValue(v)).split(';').map(x => x.trim()).filter(x => x && !/^(?:empty|none)$/i.test(x));

/**
 * Отражает каждую ставку в карточку соперника. Люди — персонажи и игрок;
 * имя игрока — отдельно (в его записи «Имени» нет).
 */
export function разложитьПари(data, имяИгрока = '') {
  if (!data || typeof data !== 'object') return data;
  const люди = [];
  if (Array.isArray(data.characters)) for (const c of data.characters) if (c && c['Имя']) люди.push({ имя: String(c['Имя']), з: c });
  if (data.user && typeof data.user === 'object') люди.push({ имя: имяИгрока || String(data.user['Имя'] || ''), з: data.user });
  const добавки = new Map();
  for (const { имя, з } of люди) {
    for (const п of списокПари(з['Пари']).map(разобратьПари).filter(Boolean)) {
      if (п.отражено || !п.с) continue;
      const соперник = люди.find(ч => ч.з !== з && (namesLikelySame(ч.имя, п.с) || namesLikelySame(п.с, ч.имя)));
      if (!соперник) continue;
      const своё = списокПари(соперник.з['Пари']).map(разобратьПари).filter(Boolean);
      // Соперник уже записал эту ставку сам или она уже отражена — не дублируем.
      if (своё.some(с => namesLikelySame(с.с, имя) && с.ставка.toLowerCase() === п.ставка.toLowerCase())) continue;
      const строка = `${ЗЕРКАЛО}${имя} | ${п.ставка} | ${п.на} | ${НАОБОРОТ[п.итог]}`;
      if (!добавки.has(соперник.з)) добавки.set(соперник.з, []);
      добавки.get(соперник.з).push(строка);
    }
  }
  for (const [з, строки] of добавки) {
    const было = списокПари(з['Пари']);
    з['Пари'] = [...было, ...строки].join('; ');
  }
  return data;
}

const ПОДПИСЬ = { open: 'идёт', won: 'выиграно', lost: 'проиграно' };
const КУБИК = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.3"/><circle cx="15.5" cy="15.5" r="1.3"/><circle cx="15.5" cy="8.5" r="1.3"/><circle cx="8.5" cy="15.5" r="1.3"/><circle cx="12" cy="12" r="1.3"/></svg>';
const МОНЕТА = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5.2"/><path d="M12 9.6v4.8"/></svg>';
/** Карточки пари для строки поля: видно, с кем и чем кончилось; на что спорили
 *  и ставка выезжают по нажатию (render/fold.js). */
export function карточкиПари(value) {
  const пари = списокПари(value).map(разобратьПари).filter(Boolean);
  if (!пари.length) return '';
  return `<div class="hud-bets">${пари.map(п => раскрывашка(`hud-bet st-${п.итог}${п.отражено ? ' is-mirror' : ''}`,
    `<i class="hud-bet-ico">${КУБИК}</i><span class="with">Пари · <b>${escapeHtml(п.с || '—')}</b></span><em class="state">${ПОДПИСЬ[п.итог]}</em>`,
    (п.на ? `<p class="on"><small>На что</small><span>${escapeHtml(п.на)}</span></p>` : '')
      + (п.ставка ? `<p class="stake"><i class="coin">${МОНЕТА}</i><small>Ставка</small><span>${escapeHtml(п.ставка)}</span></p>` : '')
      + (п.отражено ? '<p class="mirror">Записано в карточке соперника</p>' : ''))).join('')}</div>`;
}
