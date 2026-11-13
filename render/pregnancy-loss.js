// hud-manager/render/pregnancy-loss.js
//
// Конец беременности на карточке: плашка с кольцом срока вместо трекера,
// кнопка «Выкидыш или аборт» на случай, если модель этого не поняла, потеря
// одного из двойни, кубик исхода угрозы и осмотры. Логика и запись —
// render/conception.js, клики ловит index.js. Оформление — css/misc.css.

import { escapeHtml } from '../utils.js?v=23.89.21';
import { settings } from '../settings.js?v=23.89.21';
import { полеВкл } from '../deep-fields.js?v=23.89.21';
import { ВИДЫ_ПОТЕРИ, дм, восстановлениеПосле } from './conception.js?v=23.89.21';
import { ЗНАЧОК_КОРЗИНЫ } from './erase-button.js?v=23.89.21';
import { подождатьДо, ДНЕЙ_ОСЛОЖНЕНИЕ } from './rest-hint.js?v=23.89.21';
import { видБлока } from './views.js?v=23.89.21';
import { видПотери } from './views-plus.js?v=23.89.21';

const ДЕНЬ = 864e5;
const Р = 25, ДЛИНА = 2 * Math.PI * Р;
const ИКОНКИ = {
  shield: 'M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6Z M12 8.5v4 M12 15.2v.3',
  ok: 'M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6Z M8.7 12l2.4 2.4 4.3-4.6',
  pulse: 'M3 12h4l2-5 3.5 10 2.5-7 1.5 2H21',
  drop: 'M12 3c3.5 4.7 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 2.5-6.3 6-11Z',
};
const значок = (имя) => `<i class="hud-note-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${ИКОНКИ[имя]}"/></svg></i>`;

// Кольцо сорока недель: дуга обрывается там, где закончился срок.
function кольцо(неделя) {
  const есть = Number.isFinite(неделя);
  const доля = есть ? Math.max(.02, Math.min(1, неделя / 40)) : 0;
  const угол = доля * 2 * Math.PI - Math.PI / 2;
  const x = (32 + Р * Math.cos(угол)).toFixed(1), y = (32 + Р * Math.sin(угол)).toFixed(1);
  const засечка = (н) => {
    const а = н / 40 * 2 * Math.PI - Math.PI / 2;
    return `<path class="tick" d="M${(32 + 22 * Math.cos(а)).toFixed(1)} ${(32 + 22 * Math.sin(а)).toFixed(1)}L${(32 + 28 * Math.cos(а)).toFixed(1)} ${(32 + 28 * Math.sin(а)).toFixed(1)}"/>`;
  };
  return `<span class="hud-loss-ring"><svg viewBox="0 0 64 64" aria-hidden="true"><circle class="bloom" cx="32" cy="32" r="31"/><circle class="track" cx="32" cy="32" r="${Р}"/>`
    + засечка(13) + засечка(27)
    + (есть ? `<circle class="arc" cx="32" cy="32" r="${Р}" stroke-dasharray="${(ДЛИНА * доля).toFixed(1)} ${ДЛИНА.toFixed(1)}" transform="rotate(-90 32 32)"/><circle class="end" cx="${x}" cy="${y}" r="2.6"/>` : '')
    + `</svg>${есть ? `<b>${неделя}</b>` : ''}</span>`;
}

export function кнопкаПотери(кто) {
  if (settings.enablePregnancyLoss === false || !полеВкл(settings, (кто === 'user' ? 'us' : 'cs') + '.Prg.lost')) return '';
  return `<button type="button" class="hud-loss-btn" data-hud-loss="mark" data-kto="${escapeHtml(кто)}" title="Отметить выкидыш или аборт, если модель этого не заметила">Выкидыш или аборт</button>`;
}
export function кнопкаОтменыПотери(кто) {
  return `<button type="button" class="hud-loss-btn" data-hud-loss="undo" data-kto="${escapeHtml(кто)}" title="Беременность вернётся в HUD, как была до отметки">Отменить</button>`;
}

/** п — запись о потере; без кто (пример, просмотр) плашка без кнопок. */
export function блокПотери(п, { кто = '', сценаMs = null } = {}) {
  const имя = (ВИДЫ_ПОТЕРИ[п.вид] || ВИДЫ_ПОТЕРИ.miscarriage).имя;
  const дата = Number.isFinite(п.дата) ? п.дата : null;
  const сцена = Number.isFinite(сценаMs) ? сценаMs : null;
  const дней = дата !== null && сцена !== null && сцена >= дата ? Math.round((сцена - дата) / ДЕНЬ) : null;
  const срок = [Number.isFinite(п.неделя) ? `<span>${п.неделя}-я неделя</span>` : '', дата !== null ? `<span>${дм(дата)}</span>` : ''].filter(Boolean).join('<span> · </span>');
  // Что ещё впереди: прошедшее с плашки уходит.
  const в = восстановлениеПосле(п.вид, п.неделя);
  const пункт = (подпись, значение) => `<li><span>${подпись}</span><b>${значение}</b></li>`;
  const идёт = (днейДо) => дата !== null && (сцена === null || сцена < дата + днейДо * ДЕНЬ);
  const факты = [
    идёт(в.кровь) ? пункт('Кровь', `до ${дм(дата + в.кровь * ДЕНЬ)}`) : '',
    в.молоко === 'есть' && идёт(14) ? пункт('Молоко', 'придёт на 2–5 день, уйдёт за 1–2 недели') : '',
    в.молоко === 'может' && идёт(10) ? пункт('Молоко', 'может прийти немного') : '',
    Number.isFinite(п.циклК) && (сцена === null || сцена < п.циклК) ? пункт('Цикл', `≈ ${дм(п.циклК)}`) : '',
  ].filter(Boolean).join('');
  const близостьДо = дата === null ? null : дата + (в.близость + (п.осложнение ? ДНЕЙ_ОСЛОЖНЕНИЕ : 0)) * ДЕНЬ;
  const доля = дней !== null && Number.isFinite(п.циклК) && п.циклК > дата ? Math.min(100, Math.round(дней * ДЕНЬ / (п.циклК - дата) * 100)) : 0;
  const кнопки = кто ? `<div class="hud-loss-acts">${кнопкаОтменыПотери(кто)}`
    + `<button type="button" class="hud-erase-open" data-hud-erase="pregnancy" data-kto="${escapeHtml(кто)}" title="Удалить беременность из HUD" aria-label="Удалить беременность из HUD">${ЗНАЧОК_КОРЗИНЫ}</button></div>` : '';
  const подсказка = близостьДо !== null && (сцена === null || сцена < близостьДо) ? подождатьДо(дм(близостьДо)) : '';
  const вид = видБлока('lossView');
  if (вид && вид !== 'classic' && дата !== null) {
    // Вехи для других видов: те же, что в списке, и те, что уже прошли.
    const вехи = [
      идёт(в.кровь) ? { подпись: 'Кровь', текст: `до ${дм(дата + в.кровь * ДЕНЬ)}` } : null,
      в.молоко === 'есть' && идёт(14) ? { подпись: 'Молоко', текст: 'придёт на 2–5 день, уйдёт за 1–2 недели' } : null,
      в.молоко === 'может' && идёт(10) ? { подпись: 'Молоко', текст: 'может прийти немного' } : null,
      Number.isFinite(п.циклК) && (сцена === null || сцена < п.циклК) ? { подпись: 'Цикл', текст: `≈ ${дм(п.циклК)}` } : null,
    ].filter(Boolean);
    const день = (ms) => Math.round((ms - дата) / ДЕНЬ);
    const точки = [
      { подпись: 'кровь', день: в.кровь, дата: дм(дата + в.кровь * ДЕНЬ) },
      близостьДо !== null ? { подпись: 'близость', день: день(близостьДо), дата: дм(близостьДо) } : null,
      Number.isFinite(п.циклК) ? { подпись: 'цикл', день: день(п.циклК), дата: дм(п.циклК) } : null,
    ].filter(Boolean).sort((a, b) => a.день - b.день);
    const свой = видПотери({ вид: п.вид || 'miscarriage', имя, неделя: п.неделя, датаТекст: дм(дата), днейНазад: дней, вехи, точки, подсказка, кнопки }, вид);
    if (свой) return свой;
  }
  return `<div class="hud-state-plaque is-loss is-${п.вид || 'miscarriage'}" role="status"><span class="hud-note-eye hud-section-title">Конец беременности</span><div class="hud-loss-top">${кольцо(п.неделя)}`
    + `<div class="hud-loss-name"><b>${имя}</b>${срок ? `<small>${срок}</small>` : ''}</div>`
    + (дней !== null ? `<span class="hud-state-timer">${дней ? `${дней} дн. назад` : 'сегодня'}</span>` : '')
    + `</div>`
    + (факты ? `<i class="hud-loss-way" aria-hidden="true"><b style="width:${доля}%"></b></i><ul class="hud-loss-facts">${факты}</ul>` : '')
    + подсказка
    + кнопки
    + `</div>`;
}

/** Один из двойни или тройни: строка в карточке идущей беременности. */
export function блокЧастичнойПотери(п, кто) {
  const точки = Array.from({ length: п.было || (п.часть + п.осталось) }, (_, i) => `<i class="${i < п.осталось ? 'is-on' : ''}"></i>`).join('');
  return `<div class="hud-note-card is-part">${значок('drop')}<div class="hud-note-body"><span class="hud-note-eye hud-section-title">Потеря малыша</span><b>${п.часть === 1 ? 'Один малыш потерян' : 'Двое малышей потеряны'}</b>`
    + `<small>${Number.isFinite(п.дата) ? `<span>${дм(п.дата)}</span><span> · </span>` : ''}<span>Осталось малышей: ${п.осталось}</span></small></div><span class="hud-note-dots" aria-hidden="true">${точки}</span>${кнопкаОтменыПотери(кто)}</div>`;
}

/** Осмотры: скрининг по неделям. Итог открывает игрок, судьба его убирает. */
export function блокОсмотров(осмотры, кто) {
  if (settings.enablePregnancyExams === false || !Array.isArray(осмотры) || !осмотры.length) return '';
  const к = escapeHtml(кто);
  return осмотры.filter(о => полеВкл(settings, 'ui.exam.' + о.порог)).map(о => {
    const шапка = `<span class="hud-note-eye hud-section-title">Осмотр</span>`;
    if (!о.проверено) {
      return `<div class="hud-note-card is-wait">${значок('pulse')}<div class="hud-note-body">${шапка}<b>${о.порог}-я неделя</b><small>Результаты уже есть. Модель узнает их только после вас.</small></div>`
        + `<button type="button" class="hud-fetus-btn is-roll" data-hud-exam="open" data-val="${о.порог}" data-kto="${к}">Посмотреть</button></div>`;
    }
    const итог = о.снято ? [] : [о.осложнениеИмя, о.находкаИмя].filter(Boolean);
    return `<div class="hud-note-card ${итог.length ? 'is-warn' : 'is-good'}">${значок('pulse')}<div class="hud-note-body">${шапка}<b>${о.порог}-я неделя${о.снято ? '<i class="fate-mark" title="Изменено судьбой">✦︎</i>' : ''}</b>`
      + (итог.length ? `<span class="hud-note-tags">${итог.map(т => `<em>${т}</em>`).join('')}</span>` : `<small>На осмотре всё в норме</small>`) + `</div>`
      + ((о.осложнениеИмя || о.находкаИмя) ? `<button type="button" class="hud-fetus-btn is-undo" data-hud-exam="${о.снято ? 'back' : 'clear'}" data-val="${о.порог}" data-kto="${к}">${о.снято ? '↺ Откатить' : '✦︎ Изменить судьбу'}</button>` : '')
      + `</div>`;
  }).join('');
}

const ИТОГИ = { keep: 'Беременность сохранится', one: 'Один малыш не выживет', all: 'Беременность не сохранить' };
/** Исход угрозы: кубик, как у зачатия. у — запись из исходУгрозы(). */
export function блокУгрозы(у) {
  if (!у || settings.enableThreatDice === false || !полеВкл(settings, 'ui.thr')) return '';
  const кто = escapeHtml(у.кто);
  const шапка = `<span class="hud-note-eye hud-section-title">Угроза беременности</span>`;
  if (!у.проверено) {
    return `<div class="hud-note-card is-wait">${значок('shield')}<div class="hud-note-body">${шапка}<small>Исход решит кубик. Модель узнает его только после того, как узнаете вы.</small></div>`
      + `<button type="button" class="hud-fetus-btn is-roll" data-hud-threat="roll" data-kto="${кто}">Узнать исход</button></div>`;
  }
  const итог = у.судьба || у.итог;
  const кнопка = (код, надпись) => `<button type="button" class="hud-fetus-btn${код === итог ? ' is-on' : ''}" data-hud-threat="fate" data-val="${код}" data-kto="${кто}">${надпись}</button>`;
  const выбор = у.плодов > 1 ? кнопка('keep', 'Сохранить') + кнопка('one', 'Потерять одного') + кнопка('all', 'Потерять всех') : кнопка('keep', 'Сохранить') + кнопка('all', 'Потерять');
  const шкала = `<i class="hud-note-dice" aria-hidden="true"><b style="width:${у.шанс}%"></b><s style="left:${у.бросок}%"></s></i>`;
  return `<div class="hud-note-card ${итог === 'keep' ? 'is-good' : 'is-warn'}">${значок(итог === 'keep' ? 'ok' : 'shield')}<div class="hud-note-body">${шапка}<b>${ИТОГИ[итог]}${у.судьба ? '<i class="fate-mark" title="Изменено судьбой">✦︎</i>' : ''}</b><small>шанс потери ${у.шанс}% · на кубике ${у.бросок}</small>${шкала}</div>`
    + `<div class="acts"><details class="hud-fetus-fate"><summary>✦︎ Изменить судьбу</summary><div class="opts"><div class="row">${выбор}</div></div></details>`
    + (у.судьба ? `<button type="button" class="hud-fetus-btn is-undo" data-hud-threat="undo" data-kto="${кто}" title="Вернуть то, что выпало на кубике">↺ Откатить</button>` : '')
    + `</div></div>`;
}
