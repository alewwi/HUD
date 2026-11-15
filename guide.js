// hud-manager/guide.js
//
// Окно «Гайд» (Настройки → 📘 Гайд): подробное руководство по HUD.
//
// Текст — GUIDE.md и GUIDE.en.md, как у «Что нового» с чейнджлогом: правится
// как обычный документ, английский — своим файлом, без словаря. Два раздела
// собираются на месте, чтобы не отставать от кода:
//   <!-- guide:settings --> — каждая настройка из живой панели «📊 TavernOS»
//     с её пояснением (title), по группам, в том порядке, в каком они стоят;
//   <!-- guide:fields -->   — поля, которые пишет модель: каталог «Глубокой
//     настройки» (код и название) и словарь вопросиков (что это).
// Слева оглавление по разделам, сверху поиск по всему тексту.

import { английский, т } from './i18n.js?v=23.89.40';
import { escapeHtml } from './utils.js?v=23.89.40';
import { TAB_HELP, findTermHelp } from './help.js?v=23.89.40';
import { КАТАЛОГ } from './deep-fields.js?v=23.89.40';

let открыто = false;
const э = (s) => escapeHtml(String(s ?? ''));

/* --- Markdown: ровно то, что есть в GUIDE.md ------------------------------
   ## раздел, ### подраздел, абзацы, списки «-» и «1.» (вложенность — два
   пробела), «>» — заметка, ``` — код, **жирный**, *курсив*, `код`, ссылки. */
export function строкаГайда(s) {
  return э(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(«])\*([^*\s][^*]*?)\*(?=[\s).,;:!?»]|$)/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

/** Разбор: [{ id, заголовок, html }] по разделам «##». Метки <!-- guide:… --> — { вставка }. */
export function разобратьГайд(текст) {
  const разделы = [];
  let раздел = null, абзац = [], списки = [], код = null;
  const id = (з, i) => 'g-' + i + '-' + з.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40);
  const куда = () => { if (!раздел) { раздел = { id: 'g-intro', заголовок: '', части: [] }; разделы.push(раздел); } return раздел.части; };
  const закрытьАбзац = () => { if (абзац.length) { куда().push(`<p>${строкаГайда(абзац.join(' '))}</p>`); абзац = []; } };
  const закрытьСписки = (до = 0) => { while (списки.length > до) { const с = списки.pop(); const html = `<${с.тег}>${с.пункты.map(п => `<li>${п}</li>`).join('')}</${с.тег}>`; if (списки.length) { const верх = списки[списки.length - 1]; верх.пункты[верх.пункты.length - 1] += html; } else куда().push(html); } };
  for (const сырая of String(текст || '').split(/\r?\n/)) {
    if (код) { if (/^```/.test(сырая)) { куда().push(`<pre><code>${э(код.join('\n'))}</code></pre>`); код = null; } else код.push(сырая); continue; }
    if (/^```/.test(сырая)) { закрытьАбзац(); закрытьСписки(); код = []; continue; }
    const вставка = сырая.match(/^<!--\s*guide:(\w+)\s*-->$/);
    if (вставка) { закрытьАбзац(); закрытьСписки(); куда().push({ вставка: вставка[1] }); continue; }
    if (/^#\s/.test(сырая)) continue;
    const з2 = сырая.match(/^##\s+(.+?)\s*$/);
    if (з2) { закрытьАбзац(); закрытьСписки(); раздел = { id: id(з2[1], разделы.length), заголовок: з2[1], части: [] }; разделы.push(раздел); continue; }
    const з3 = сырая.match(/^###\s+(.+?)\s*$/);
    if (з3) { закрытьАбзац(); закрытьСписки(); куда().push(`<h4>${строкаГайда(з3[1])}</h4>`); continue; }
    const пункт = сырая.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (пункт) {
      закрытьАбзац();
      const уровень = Math.floor(пункт[1].length / 2) + 1, тег = /\d/.test(пункт[2]) ? 'ol' : 'ul';
      закрытьСписки(уровень);
      while (списки.length < уровень) списки.push({ тег, пункты: [] });
      списки[списки.length - 1].пункты.push(строкаГайда(пункт[3]));
      continue;
    }
    const заметка = сырая.match(/^>\s?(.*)$/);
    if (заметка) { закрытьАбзац(); закрытьСписки(); куда().push(`<div class="hud-guide-tip">${строкаГайда(заметка[1])}</div>`); continue; }
    if (!сырая.trim()) { закрытьАбзац(); закрытьСписки(); continue; }
    // Продолжение пункта списка на следующей строке с отступом.
    if (списки.length && /^\s{2,}\S/.test(сырая)) { const с = списки[списки.length - 1]; с.пункты[с.пункты.length - 1] += ' ' + строкаГайда(сырая.trim()); continue; }
    закрытьСписки();
    абзац.push(сырая.trim());
  }
  закрытьАбзац(); закрытьСписки();
  return разделы;
}

/* --- Все настройки: из живой панели -------------------------------------- */
const чисто = (s) => String(s || '').replace(/\s+/g, ' ').trim();
function подписьЭлемента(эл) {
  const копия = эл.cloneNode(true);
  копия.querySelectorAll('select, input, textarea, option, .hud-help-mark, script, style').forEach(x => x.remove());
  return чисто(копия.textContent).replace(/[:：]\s*$/, '');
}
function пунктНастройки(эл) {
  const имя = подписьЭлемента(эл);
  if (!имя) return '';
  const пояснение = чисто(эл.getAttribute('title') || эл.querySelector('[title]')?.getAttribute('title') || '');
  const варианты = [...эл.querySelectorAll('select option')].map(o => чисто(o.textContent)).filter(Boolean);
  return `<li><b>${э(имя)}</b>${пояснение ? ` — ${э(пояснение)}` : ''}${варианты.length > 1 && варианты.length <= 12 ? `<div class="hud-guide-opts">${варианты.map(в => `<span>${э(в)}</span>`).join('')}</div>` : ''}</li>`;
}
// Элементы внутри одного уровня группы: свои пункты, заметки и подгруппы; во
// вложенные группы не заходим — у них свой список.
function пунктыУровня(корень) {
  const out = [];
  const обойти = (узел) => {
    for (const ребёнок of узел.children) {
      // Списки, которые панель заполняет сама (аватарки персонажей), — это данные
      // игрока, а не настройки: в гайде без них, иначе десятки «Заменить картинку».
      if (ребёнок.matches('.hud-ava-list, [data-guide-skip]')) continue;
      if (ребёнок.matches('details.hud-set-group')) { out.push(группаНастроек(ребёнок)); continue; }
      if (ребёнок.matches('label.hud-set-check, label')) { out.push(пунктНастройки(ребёнок)); continue; }
      if (ребёнок.matches('button, .menu_button, .hud-set-tool-btn')) { const имя = подписьЭлемента(ребёнок); if (имя) out.push(`<li><b>${э(имя)}</b>${ребёнок.title ? ` — ${э(чисто(ребёнок.title))}` : ''}</li>`); continue; }
      if (ребёнок.matches('.hud-set-note, [data-guide-note]')) { const т = чисто(ребёнок.textContent); if (т) out.push(`<li class="hud-guide-note">${э(т)}</li>`); continue; }
      if (ребёнок.matches('input, select, textarea, [hidden]') || ребёнок.hidden) continue;
      обойти(ребёнок);
    }
  };
  обойти(корень);
  return out.filter(Boolean);
}
function группаНастроек(details) {
  const заголовок = чисто(details.querySelector(':scope > summary')?.textContent);
  const тело = details.querySelector(':scope > .hud-set-body') || details;
  const пункты = пунктыУровня(тело);
  if (!пункты.length) return '';
  return `<li class="hud-guide-group"><details><summary>${э(заголовок)}</summary><ul>${пункты.join('')}</ul></details></li>`;
}
export function настройкиИзПанели(корень = document.getElementById('hud-settings-wrapper')) {
  if (!корень) return `<p class="hud-guide-note">${э(т('Откройте настройки HUD в «Расширениях», и здесь появится полный список.'))}</p>`;
  const тело = корень.querySelector(':scope > div') || корень;
  const пункты = пунктыУровня(тело);
  return `<ul class="hud-guide-settings">${пункты.join('')}</ul>`;
}

/* --- Поля, которые пишет модель ----------------------------------------- */
const ВКЛАДКА = { cs: 'character', us: 'user', me: 'memory', dy: 'diary', dr: 'dreams', pet: 'pets', cb: 'combat', bb: 'babies', wd: 'world' };
export function поляМодели() {
  return КАТАЛОГ.map(р => {
    const вкладка = TAB_HELP[ВКЛАДКА[р.код]];
    const вНастройках = /^(?:nt|ui)$/.test(р.код);
    const группы = р.группы.map(г => {
      const поля = г.поля.map(([код, имя, под]) => {
        const статья = findTermHelp(имя);
        return `<li><code>${э(код)}</code> <b>${э(т(имя))}</b>${статья ? ` — ${э(т(статья.what))}` : ''}`
          + (под && под.length ? `<div class="hud-guide-opts">${под.map(([пк, пи]) => `<span><code>${э(пк)}</code> ${э(т(пи))}</span>`).join('')}</div>` : '') + `</li>`;
      }).join('');
      return `<h5>${э(т(г.имя))}${г.код && г.код !== р.код ? ` <code>${э(г.код)}</code>` : ''}</h5><ul>${поля}</ul>`;
    }).join('');
    return `<details class="hud-guide-group"><summary>${э(т(р.имя))} ${вНастройках ? `<small>${э(т('пишет HUD, не модель'))}</small>` : `<code>${э(р.код)}</code>`}</summary>`
      + (вкладка ? `<p class="hud-guide-note">${э(т(вкладка.what))} ${э(т(вкладка.how))}</p>` : '') + группы + `</details>`;
  }).join('');
}

/* --- Окно ------------------------------------------------------------------ */
async function загрузить() {
  const файл = английский() ? 'GUIDE.en.md' : 'GUIDE.md';
  const адрес = new URL(файл, import.meta.url);
  адрес.searchParams.set('v', new URL(import.meta.url).searchParams.get('v') || String(Date.now()));
  const ответ = await fetch(адрес.href);
  if (!ответ.ok) throw new Error('HTTP ' + ответ.status);
  return разобратьГайд(await ответ.text());
}

function собрать(разделы) {
  const вставки = { settings: () => настройкиИзПанели(), fields: () => поляМодели() };
  const тело = разделы.map(р => `<section class="hud-guide-sec" id="${р.id}">${р.заголовок ? `<h3>${строкаГайда(р.заголовок)}</h3>` : ''}`
    + р.части.map(ч => (typeof ч === 'string' ? ч : `<div class="hud-guide-gen" data-gen="${ч.вставка}">${(вставки[ч.вставка] || (() => ''))()}</div>`)).join('') + `</section>`).join('');
  const оглавление = разделы.filter(р => р.заголовок).map(р => `<a href="#${р.id}" data-guide-go="${р.id}">${строкаГайда(р.заголовок)}</a>`).join('');
  return { тело, оглавление };
}

// Поиск: показываем пункты, абзацы и группы с совпадением; раздел без
// совпадений прячем целиком. Пустой запрос — всё как было.
function искать(окно, запрос) {
  const q = запрос.trim().toLowerCase().replace(/ё/g, 'е');
  const текстУзла = (у) => (у.textContent || '').toLowerCase().replace(/ё/g, 'е');
  let найдено = 0;
  for (const сек of окно.querySelectorAll('.hud-guide-sec')) {
    let есть = false;
    for (const у of сек.querySelectorAll('li, p, pre, .hud-guide-tip, h4, h5')) {
      const да = !q || текстУзла(у).includes(q);
      у.classList.toggle('is-miss', !да);
      if (да) есть = true;
    }
    // Пункт со вложенным совпадением не прячем: родители совпавшего видны.
    if (q) сек.querySelectorAll('li:not(.is-miss), p:not(.is-miss), h5:not(.is-miss)').forEach(у => { for (let р = у.parentElement; р && р !== сек; р = р.parentElement) р.classList.remove('is-miss'); });
    if (q) сек.querySelectorAll('details').forEach(д => { д.open = !!д.querySelector('li:not(.is-miss)'); });
    const з = сек.querySelector('h3');
    if (з && q && текстУзла(з).includes(q)) { сек.querySelectorAll('.is-miss').forEach(у => у.classList.remove('is-miss')); есть = true; }
    сек.hidden = !!q && !есть;
    if (!сек.hidden) найдено++;
  }
  окно.querySelector('.hud-guide-empty').hidden = найдено > 0;
}

function нарисовать(разделы) {
  const { тело, оглавление } = собрать(разделы);
  const overlay = document.createElement('div');
  overlay.className = 'hud-modal-overlay hud-guide-overlay';
  overlay.innerHTML = `<div class="hud-modal hud-guide" role="dialog" aria-modal="true" aria-label="${э(т('Гайд'))}">
    <div class="hud-modal-head"><span>${э(т('Гайд по TavernOS HUD'))}</span>
      <input type="search" class="hud-guide-search" placeholder="${э(т('Поиск по гайду'))}" aria-label="${э(т('Поиск по гайду'))}">
      <button type="button" class="hud-guide-x" aria-label="${э(т('Закрыть'))}">✕</button></div>
    <div class="hud-guide-main">
      <nav class="hud-guide-toc" aria-label="${э(т('Оглавление'))}"><details open><summary>${э(т('Оглавление'))}</summary>${оглавление}</details></nav>
      <div class="hud-modal-body hud-guide-body">${тело}<p class="hud-guide-empty" hidden>${э(т('Ничего не нашлось'))}</p></div>
    </div>
  </div>`;
  // Текст гайда уже на нужном языке — словарь его не трогает. Собранные
  // разделы (настройки, поля) переведены при сборке.
  overlay.querySelector('.hud-guide-body').setAttribute('data-i18n-skip', '');
  overlay.querySelector('.hud-guide-toc').setAttribute('data-i18n-skip', '');
  const закрыть = () => { открыто = false; overlay.remove(); document.removeEventListener('keydown', поКлавише, true); };
  const поКлавише = (e) => { if (e.key === 'Escape') { e.stopPropagation(); закрыть(); } };
  document.addEventListener('keydown', поКлавише, true);
  let нажатоНаФоне = false;
  overlay.addEventListener('mousedown', (e) => { нажатоНаФоне = e.target === overlay; });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && нажатоНаФоне) return закрыть();
    const ссылка = e.target.closest('[data-guide-go]');
    if (ссылка) {
      e.preventDefault();
      const цель = overlay.querySelector('#' + CSS.escape(ссылка.dataset.guideGo));
      if (цель) цель.scrollIntoView({ block: 'start', behavior: 'smooth' });
      // На телефоне оглавление сверху — сворачиваем, чтобы было видно раздел.
      if (window.matchMedia && window.matchMedia('(max-width: 700px)').matches) overlay.querySelector('.hud-guide-toc details').open = false;
    }
  });
  overlay.querySelector('.hud-guide-x').addEventListener('click', закрыть);
  const поиск = overlay.querySelector('.hud-guide-search');
  let таймер = 0;
  поиск.addEventListener('input', () => { clearTimeout(таймер); таймер = setTimeout(() => искать(overlay, поиск.value), 120); });
  if (window.matchMedia && window.matchMedia('(max-width: 700px)').matches) overlay.querySelector('.hud-guide-toc details').open = false;
  document.body.appendChild(overlay);
  поиск.focus({ preventScroll: true });
  return overlay;
}

/** Открыть гайд. Возвращает true, если окно открылось. */
export async function показатьГайд() {
  if (открыто) return false;
  открыто = true;
  try {
    нарисовать(await загрузить());
    return true;
  } catch (e) {
    открыто = false;
    console.warn('[TavernOS HUD] Гайд', e);
    return false;
  }
}
