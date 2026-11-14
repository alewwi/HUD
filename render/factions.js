// hud-manager/render/factions.js
//
// Фракции и репутация — слой мира (wd.rep): как банды, полиция, гильдии,
// однокурсники относятся к игроку и/или персонажу. Строка модели:
// «Регенты | Мари | 80 | уважают | вытащила их человека со склада».
// Карточка: шкала от −100 до 100, отношение словом, за что — и сдвиги из
// прошлых ходов, как шрамы у доверия. Настройка factions: user, char или both
// (тогда — две вкладки).
//
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

import { escapeHtml } from '../utils.js?v=23.89.28';
import { settings } from '../settings.js?v=23.89.28';
import { namesLikelySame } from '../names.js?v=23.89.28';
import { раскрывашка } from './fold.js?v=23.89.28';

/** «Регенты | Мари | 80 | уважают | за что» → { кто, к, число, как, почему }. */
export function разобратьФракцию(строка) {
  const [кто = '', к = '', число = '', как = '', ...почему] = String(строка ?? '').split('|').map(x => x.trim());
  if (!кто) return null;
  const n = parseInt(String(число).replace('−', '-').replace('+', ''), 10);
  return { кто, к, число: Number.isFinite(n) ? Math.max(-100, Math.min(100, n)) : null, как, почему: почему.join(' | ') };
}

const ключ = (ф) => String(ф.кто).toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

// К кому строка: игрок, персонаж или (при одной цели) — та, что в настройке.
function цельСтроки(ф, игрок, персонаж, режим) {
  if (режим !== 'both') return режим === 'char' ? 'char' : 'user';
  const к = ф.к;
  if (к && персонаж && (namesLikelySame(к, персонаж) || namesLikelySame(персонаж, к))) return 'char';
  if (к && игрок && (namesLikelySame(к, игрок) || namesLikelySame(игрок, к))) return 'user';
  if (/\{\{char\}\}/i.test(к)) return 'char';
  return 'user';
}

/**
 * Сдвиги репутации из прошлых ходов. история — [{ строки: [...], дата }] от
 * старых к новым (последний — этот ход). → Map(ключ цели|фракции → [{ было, стало, почему, дата }]).
 */
export function сдвигиФракций(история, игрок, персонаж, режим) {
  const прежнее = new Map(), сдвиги = new Map();
  for (const ход of история) {
    for (const ф of (ход.строки || []).map(разобратьФракцию).filter(Boolean)) {
      if (ф.число === null) continue;
      const к = цельСтроки(ф, игрок, персонаж, режим) + '|' + ключ(ф);
      const было = прежнее.get(к);
      if (было !== undefined && было !== ф.число) {
        if (!сдвиги.has(к)) сдвиги.set(к, []);
        сдвиги.get(к).push({ было, стало: ф.число, почему: ф.почему, дата: ход.дата || '' });
      }
      прежнее.set(к, ф.число);
    }
  }
  return сдвиги;
}

const тон = (n) => (n === null ? 'is-none' : n >= 40 ? 'is-good' : n > 10 ? 'is-warm' : n >= -10 ? 'is-even' : n > -40 ? 'is-cold' : 'is-bad');
const ЩИТ = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 4.5 5.6v5.6c0 4.8 3.2 8.7 7.5 10 4.3-1.3 7.5-5.2 7.5-10V5.6z"/><path d="M12 7v9M8.5 11.5h7"/></svg>';

// Карточка: щит, название, отношение, число и шкала видны сразу (и значок
// последнего сдвига); за что и как менялось — выезжает по нажатию (render/fold.js).
function карточка(ф, сдвиги) {
  const n = ф.число;
  // Шкала из середины: вправо — тепло, влево — вражда.
  const ширина = n === null ? 0 : Math.abs(n) / 2;
  const полоса = n === null ? '' : `<span class="bar" aria-hidden="true"><i class="mid"></i><i class="fill ${n < 0 ? 'neg' : 'pos'}" style="--w:${ширина}%"></i></span>`;
  const последние = (сдвиги || []).slice(-3).reverse();
  const шаг = последние.length ? последние[0].стало - последние[0].было : 0;
  const голова = `<i class="hud-rep-ico">${ЩИТ}</i><span class="name"><b class="who">${escapeHtml(ф.кто)}</b>`
    + `${ф.как ? `<em class="att">${escapeHtml(ф.как)}</em>` : ''}${шаг ? `<small class="step ${шаг > 0 ? 'up' : 'down'}">${шаг > 0 ? '▲ +' : '▼ '}${шаг}</small>` : ''}</span>`
    + `${n === null ? '' : `<span class="num">${n > 0 ? '+' : ''}${n}</span>`}${полоса}`;
  const подробно = (ф.почему ? `<p class="why"><small>За что</small><span>${escapeHtml(ф.почему)}</span></p>` : '')
    + (последние.length ? `<div class="hud-rep-shifts"><small>Как менялось</small><ul>${последние.map(с => { const d = с.стало - с.было; return `<li class="${d > 0 ? 'up' : 'down'}"><b>${d > 0 ? '▲ +' : '▼ '}${d}</b>${с.дата ? ` <small>${escapeHtml(с.дата)}</small>` : ''}${с.почему ? ` <span>${escapeHtml(с.почему)}</span>` : ''}</li>`; }).join('')}</ul></div>` : '');
  return раскрывашка(`hud-rep-card ${тон(n)}`, голова, подробно);
}

/**
 * Раздел «Фракции и репутация» для вкладки «Мир». строки — wd.rep этого хода;
 * история — см. сдвигиФракций; uid — для переключателя двух вкладок.
 */
export function блокФракций(строки, { игрок = '', персонаж = '', история = [], uid = 'rep' } = {}) {
  const режим = settings.factions || 'user';
  if (режим === 'off') return '';
  const фракции = (Array.isArray(строки) ? строки : []).map(разобратьФракцию).filter(Boolean);
  if (!фракции.length) return '';
  const сдвиги = сдвигиФракций(история, игрок, персонаж, режим);
  const группа = (цель) => фракции.filter(ф => цельСтроки(ф, игрок, персонаж, режим) === цель)
    .sort((а, б) => (б.число ?? -999) - (а.число ?? -999))
    .map(ф => карточка(ф, сдвиги.get(цель + '|' + ключ(ф)))).join('');
  const заголовок = '<div class="hud-world-title">🛡 Фракции и репутация</div>';
  if (режим !== 'both') return `<div class="hud-world-section hud-rep">${заголовок}<div class="hud-rep-list">${группа(режим === 'char' ? 'char' : 'user')}</div></div>`;
  const кИгроку = группа('user'), кПерсонажу = группа('char');
  const имя = (s, запас) => escapeHtml(String(s || запас));
  return `<div class="hud-world-section hud-rep is-two">${заголовок}`
    + `<input type="radio" class="hud-rep-r u" name="${uid}-rep" id="${uid}-rep-u" checked hidden><input type="radio" class="hud-rep-r c" name="${uid}-rep" id="${uid}-rep-c" hidden>`
    + `<div class="hud-rep-tabs" role="tablist"><label for="${uid}-rep-u" role="tab">К игроку · ${имя(игрок, 'игрок')}</label><label for="${uid}-rep-c" role="tab">К персонажу · ${имя(персонаж, 'персонаж')}</label></div>`
    + `<div class="hud-rep-list pane-u">${кИгроку || '<p class="hud-rep-empty">Пока никто не определился.</p>'}</div>`
    + `<div class="hud-rep-list pane-c">${кПерсонажу || '<p class="hud-rep-empty">Пока никто не определился.</p>'}</div></div>`;
}
