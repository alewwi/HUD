// hud-manager/render/heraldry-edit.js
//
// Окно знака рода (нажатие на щит у имени, render/heraldry.js): что носит род
// — герб, знак ремесла или домовую метку, — другой вариант по «↻» или свой
// выбор поля, деления и фигуры. Выбор живёт в данных чата; «Как было» — снова
// по роли и роду.
//
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

import { escapeHtml } from '../utils.js?v=23.89.79';
import { т } from '../i18n.js?v=23.89.79';
import { связьПраздников } from './holiday-lore.js?v=23.89.79';
import { сословие, гербРода, поправитьГерб, svgГерба, svgРемесла, svgМетки, выборРода, сохранитьВыборРода, ФИНИФТИ, МЕТАЛЛЫ, ДЕЛЕНИЯ, ФИГУРЫ } from './heraldry.js?v=23.89.79';

const РЕМЁСЛА = { hammer: 'кузнец', shears: 'портной, ткач', pretzel: 'пекарь', wheel: 'мельник', axe: 'плотник', fish: 'рыбак', mug: 'трактир', cup: 'лекарь', scales: 'купец', jug: 'гончар' };
let открыто = false;

export function открытьГерб(род, роль = '') {
  if (открыто || !род) return;
  открыто = true;
  const п = (s) => escapeHtml(т(s));
  const было = выборРода(род) || {};
  let вид = было.вид || сословие(роль);
  let вариант = было.вариант || 0;
  let герб = было.герб ? поправитьГерб(было.герб) : гербРода(род, вариант);
  const опции = (словарь, текущее) => Object.entries(словарь).map(([к, в]) => `<option value="${к}"${к === текущее ? ' selected' : ''}>${п(Array.isArray(в) ? в[0] : в)}</option>`).join('');
  const тинктуры = { ...МЕТАЛЛЫ, ...ФИНИФТИ };

  const overlay = document.createElement('div');
  overlay.className = 'hud-modal-overlay';
  overlay.innerHTML = `
    <div class="hud-modal hud-holgen hud-armsgen" role="dialog" aria-modal="true" aria-label="${п('Знак рода')}">
      <div class="hud-modal-head"><span class="hud-holgen-orb" aria-hidden="true"></span><span class="hud-holgen-title">${п('Знак рода')} <b data-i18n-skip>${escapeHtml(род.replace(/^./, (c) => c.toUpperCase()))}</b></span><button type="button" class="hud-modal-x" aria-label="${п('Закрыть')}">✕</button></div>
      <div class="hud-modal-body">
        <div class="hud-armsgen-top"><div class="hud-armsgen-preview"></div>
          <label class="hud-holgen-field"><span class="hud-holgen-lbl">${п('Что носит род')}</span><select class="hud-armsgen-kind">
            <option value="arms">${п('Герб — знать')}</option>${Object.entries(РЕМЁСЛА).map(([к, в]) => `<option value="craft:${к}">${п('Знак ремесла')} — ${п(в)}</option>`).join('')}<option value="mark">${п('Домовая метка')}</option>
          </select></label></div>
        <div class="hud-armsgen-arms">
          <div class="hud-holgen-row">
            <label class="hud-holgen-field"><span class="hud-holgen-lbl">${п('Поле')}</span><select data-part="поле">${опции(тинктуры, герб.поле)}</select></label>
            <label class="hud-holgen-field"><span class="hud-holgen-lbl">${п('Второй цвет')}</span><select data-part="второй">${опции(тинктуры, герб.второй)}</select></label>
          </div>
          <div class="hud-holgen-row">
            <label class="hud-holgen-field"><span class="hud-holgen-lbl">${п('Деление')}</span><select data-part="деление">${опции(ДЕЛЕНИЯ, герб.деление)}</select></label>
            <label class="hud-holgen-field"><span class="hud-holgen-lbl">${п('Фигура')}</span><select data-part="фигура">${опции(ФИГУРЫ, герб.фигура)}</select></label>
          </div>
          <p class="hud-holgen-note">${п('Металл не кладут на металл: второй цвет HUD поправит сам.')}</p>
        </div>
        <div class="hud-prepgen-buttons"><button type="button" class="hud-prepgen-again hud-armsgen-roll">↻ ${п('Другой вариант')}</button><button type="button" class="hud-prepgen-again hud-armsgen-reset">${п('Как было')}</button><button type="button" class="hud-prepgen-ok">${п('Сохранить')}</button><button type="button" class="hud-prepgen-cancel">${п('Отмена')}</button></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const окно = overlay.querySelector('.hud-armsgen');
  const вид_ = окно.querySelector('.hud-armsgen-kind');
  вид_.value = вид;
  if (вид_.value !== вид) { вид = 'mark'; вид_.value = 'mark'; }

  const показать = () => {
    окно.querySelector('.hud-armsgen-preview').innerHTML = вид === 'arms' ? svgГерба(герб, 'hud-arms is-big') : вид.startsWith('craft:') ? svgРемесла(вид.slice(6), 'hud-arms is-craft is-big') : svgМетки(род, вариант, 'hud-arms is-mark is-big');
    окно.querySelector('.hud-armsgen-arms').hidden = вид !== 'arms';
    окно.querySelector('.hud-armsgen-roll').hidden = вид.startsWith('craft:');
    for (const sel of окно.querySelectorAll('[data-part]')) sel.value = герб[sel.dataset.part];
  };
  показать();

  const закрыть = () => { overlay.remove(); открыто = false; document.removeEventListener('keydown', поEsc, true); };
  const поEsc = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); закрыть(); } };
  document.addEventListener('keydown', поEsc, true);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) закрыть(); });
  окно.querySelector('.hud-modal-x').addEventListener('click', закрыть);
  окно.querySelector('.hud-prepgen-cancel').addEventListener('click', закрыть);
  вид_.addEventListener('change', () => { вид = вид_.value; показать(); });
  окно.addEventListener('change', (e) => {
    const sel = e.target.closest('[data-part]');
    if (!sel) return;
    герб = поправитьГерб({ ...герб, [sel.dataset.part]: sel.value, ...(sel.dataset.part === 'поле' ? { второй: герб.второй } : {}) });
    показать();
  });
  окно.querySelector('.hud-armsgen-roll').addEventListener('click', () => { вариант += 1; if (вид === 'arms') герб = гербРода(род, вариант); показать(); });
  окно.querySelector('.hud-armsgen-reset').addEventListener('click', () => { вид = сословие(роль); вид_.value = вид; вариант = 0; герб = гербРода(род, 0); показать(); });
  окно.querySelector('.hud-prepgen-ok').addEventListener('click', () => {
    // Совпадает с тем, что HUD выбрал бы сам, — запись не нужна.
    const сам = вид === сословие(роль) && вариант === 0 && JSON.stringify(герб) === JSON.stringify(гербРода(род, 0));
    сохранитьВыборРода(род, сам ? null : { вид, вариант, ...(вид === 'arms' ? { герб } : {}) });
    закрыть();
    try { связьПраздников().перерисовать?.(); } catch (_) { /* обновится со следующим ходом */ }
  });
}
