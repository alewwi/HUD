// hud-manager/render/fold.js
//
// Раскрывашка для плашек: заголовок — кнопка, подробности под ней плавно
// выезжают (css/story-layers.css, .hud-fold). Открытие — класс is-open, а не
// инлайн-стиль: в больших чатах запись стиля у Таверны стоит дорого.
// Используют «Назревает» (consequences.js), пари (bets.js), фракции (factions.js).
//
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

const СТРЕЛКА = '<svg class="hud-fold-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';

/** Плашка: голова (видна всегда) и подробности (скрыты до нажатия). */
export function раскрывашка(класс, голова, подробности, атрибуты = '') {
  if (!подробности) return `<div class="hud-fold is-static ${класс}"${атрибуты}><div class="hud-fold-head">${голова}</div></div>`;
  return `<div class="hud-fold ${класс}"${атрибуты}><button type="button" class="hud-fold-head" aria-expanded="false">${голова}${СТРЕЛКА}</button>`
    + `<div class="hud-fold-body"><div class="hud-fold-in">${подробности}</div></div></div>`;
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function' && !globalThis.__hudFoldBound) {
  globalThis.__hudFoldBound = true;
  document.addEventListener('click', (e) => {
    const голова = e.target && e.target.closest ? e.target.closest('.hud-fold > .hud-fold-head') : null;
    if (!голова || голова.tagName !== 'BUTTON') return;
    e.preventDefault(); e.stopPropagation();
    const плашка = голова.parentElement;
    const открыта = плашка.classList.toggle('is-open');
    голова.setAttribute('aria-expanded', String(открыта));
  }, true);
}
