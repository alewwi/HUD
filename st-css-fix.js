// hud-manager/st-css-fix.js
//
// Два правила самой Таверны (public/css/toggle-dependent.css) делают ЛЮБУЮ
// запись в element.style внутри чата дорогой: у них внутри :has() стоит
// атрибут [style*=…], и браузер на каждое изменение style перепроверяет весь
// документ. Замер на чате в 60 МБ: изменение style у одного узла в сообщении —
// 110–130 мс пересчёта стилей, без этих правил — 1 мс. HUD (плавная смена
// вкладок, потолки списков, анимации) и сама Таверна пишут в style постоянно.
//
//   1. body.documentstyle #chat .last_mes:has(> .del_checkbox[style*="display: block"]) .mes_text
//      Работает только в виде чата «Документ». В других видах правило не
//      может совпасть ни с чем — снимаем, пока на body нет .documentstyle,
//      и возвращаем на прежнее место, как только вид переключат.
//   2. #adaptive_p_block:has([…adaptive_target][style*="display: none"]):has([…adaptive_decay][style*="display: none"])
//      Прячет блок адаптивного сэмплера в настройках Text Completion, когда
//      оба его ползунка скрыты. Заменяем правилом по классу, а класс ставит
//      наблюдатель за этими двумя ползунками — вид тот же.
//
// Настройка fixStSlowCss (по умолчанию включена); выключение возвращает всё как было.

import { settings } from './settings.js?v=23.84.1';

const ПРИЗНАК_1 = ':has(> .del_checkbox[style*=';
const ПРИЗНАК_2 = '#adaptive_p_block:has(';
const КЛАСС_2 = 'hud-st-adaptive-off';

const снятые = []; // { лист, индекс, текст, вид }
let наблюдательТела = null, наблюдательБлока = null;

function листыТаверны() {
  const out = [];
  for (const лист of document.styleSheets) {
    let правила;
    try { правила = лист.cssRules; } catch (_) { continue; }
    if (правила && /toggle-dependent\.css/.test(лист.href || '')) out.push(лист);
  }
  return out;
}

function найти(признак) {
  for (const лист of листыТаверны()) {
    const правила = [...лист.cssRules];
    const i = правила.findIndex(п => п.cssText.includes(признак));
    if (i >= 0) return { лист, индекс: i, текст: правила[i].cssText };
  }
  return null;
}

function снять(признак, вид, замена = '') {
  if (снятые.some(с => с.вид === вид)) return;
  const н = найти(признак);
  if (!н) return;
  н.лист.deleteRule(н.индекс);
  if (замена) н.лист.insertRule(замена, н.индекс);
  снятые.push({ ...н, вид, замена: !!замена });
}

function вернуть(вид) {
  const i = снятые.findIndex(с => с.вид === вид);
  if (i < 0) return;
  const с = снятые[i];
  снятые.splice(i, 1);
  try {
    if (с.замена) {
      const правила = [...с.лист.cssRules];
      const k = правила.findIndex(п => п.cssText.includes(КЛАСС_2));
      if (k >= 0) с.лист.deleteRule(k);
    }
    с.лист.insertRule(с.текст, Math.min(с.индекс, с.лист.cssRules.length));
  } catch (e) { console.warn('[TavernOS HUD] правило Таверны не вернулось', e); }
}

// Правило 1: только пока вид чата не «Документ».
function сверитьВидЧата() {
  if (document.body.classList.contains('documentstyle')) вернуть('документ');
  else снять(ПРИЗНАК_1, 'документ');
}

// Правило 2: класс вместо :has([style*=…]).
function сверитьСэмплер() {
  const блок = document.getElementById('adaptive_p_block');
  if (!блок) return;
  const скрыт = (имя) => { const у = блок.querySelector(`[data-tg-samplers="${имя}"]`); return !!у && у.style.display === 'none'; };
  блок.classList.toggle(КЛАСС_2, скрыт('adaptive_target') && скрыт('adaptive_decay'));
}

export function применитьПравкуCSSТаверны() {
  if (typeof document === 'undefined' || !document.body) return;
  try {
    if (settings.fixStSlowCss === false) {
      вернуть('документ'); вернуть('сэмплер');
      наблюдательТела?.disconnect(); наблюдательТела = null;
      наблюдательБлока?.disconnect(); наблюдательБлока = null;
      document.getElementById('adaptive_p_block')?.classList.remove(КЛАСС_2);
      return;
    }
    сверитьВидЧата();
    if (!наблюдательТела) {
      наблюдательТела = new MutationObserver(сверитьВидЧата);
      наблюдательТела.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    const блок = document.getElementById('adaptive_p_block');
    if (блок) {
      сверитьСэмплер();
      снять(ПРИЗНАК_2, 'сэмплер', `#adaptive_p_block.${КЛАСС_2} { display: none; }`);
      if (!наблюдательБлока) {
        наблюдательБлока = new MutationObserver(сверитьСэмплер);
        наблюдательБлока.observe(блок, { attributes: true, attributeFilter: ['style'], subtree: true });
      }
    }
  } catch (e) { console.warn('[TavernOS HUD] правка правил Таверны', e); }
}
