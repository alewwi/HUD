// hud-manager/render/memory.js
//
// Домен «Память»: таймлайн, настроение, маршрут дня, кольцо секретов и
// сборка HTML вкладки. Вынесено из index.js без изменения поведения.
//
// Вкладка памяти встраивает граф отношений, поэтому модуль зависит от
// ./relations-graph.js.

import { escapeHtml, applyTooltips, buildPillList, getSafeUserName } from '../utils.js?v=23.9.2';
import { isNewLoreItem, loreButtonHTML } from '../lore.js?v=23.9.2';
import { buildRelGraphHTML, hudHasRelations } from './relations-graph.js?v=23.9.2';
import { отложитьРисунок } from './lazy-svg.js?v=23.9.2';
import { длинныйСписок } from './long-list.js?v=23.9.2';
import { видБлока, видМаршрута, видСекретов, видРужей } from './views.js?v=23.9.2';
import { статусРужья } from '../codes.js?v=23.9.2';

function parseRoutePoint(item) {
  const parts = String(item).split(/[-—–]/).map(s => s.trim());
  const time = parts[0] || '';
  const place = parts[1] || '';
  const action = parts.slice(2).join(' — ') || '';
  if (time.match(/^\[?[\d]{1,2}\s*:\s*\d{2}\]?$/)) return { time, place: place || String(item), action };
  return { time: '', place: String(item), action: '' };
}

// Минуты из «21:40» — нужны, чтобы показать, сколько заняло между точками.
function routeMinutes(time) {
  const m = String(time || '').match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function buildRouteMapHTML(routeArr, entityLabel) {
  if (!routeArr || routeArr.length === 0) return '';
  const pts = routeArr.map(parseRoutePoint);
  // Схема маршрута вместо кривой на сетке. Кривая была нечитаемой: длинные
  // названия не помещались и обрезались, действие показать было негде,
  // а сама линия ничего не сообщала — только «точек три». Здесь маршрут
  // разложен как схема линии метро: время, номер остановки, место и что
  // там произошло, плюс перегон с длительностью между остановками.
  const rows = pts.map((p, i) => {
    const last = i === pts.length - 1;
    const prevMin = i > 0 ? routeMinutes(pts[i - 1].time) : null;
    const curMin = routeMinutes(p.time);
    let gap = '';
    if (prevMin !== null && curMin !== null) {
      let d = curMin - prevMin;
      if (d < 0) d += 24 * 60;               // маршрут через полночь
      if (d > 0 && d < 24 * 60) gap = d >= 60 ? `${Math.floor(d / 60)} ч ${d % 60 ? (d % 60) + ' мин' : ''}`.trim() : `${d} мин`;
    }
    const place = (p.place || '').trim() || 'Без названия';
    const time = (p.time || '').replace(/[\[\]]/g, '').trim();
    return `${i > 0 ? `<li class="hud-route-leg"><span class="hud-route-leg-line"></span>${gap ? `<span class="hud-route-leg-time">${escapeHtml(gap)}</span>` : ''}</li>` : ''}
      <li class="hud-route-stop${last ? ' is-current' : ''}${i === 0 ? ' is-start' : ''}">
        <span class="hud-route-time">${escapeHtml(time)}</span>
        <span class="hud-route-pin"><i>${i + 1}</i></span>
        <span class="hud-route-info">
          <b>${escapeHtml(place)}</b>
          ${p.action ? `<small>${escapeHtml(p.action)}</small>` : ''}
        </span>
      </li>`;
  }).join('');

  const first = (pts[0].time || '').replace(/[\[\]]/g, '').trim();
  const lastT = (pts[pts.length - 1].time || '').replace(/[\[\]]/g, '').trim();
  const span = first && lastT && first !== lastT ? `${first} — ${lastT}` : (first || lastT || '');
  const word = pts.length === 1 ? 'точка' : (pts.length < 5 ? 'точки' : 'точек');

  return `<div class="hud-route-map" title="Маршрут за текущий отрезок истории">
    <div class="hud-route-head">
      <span class="hud-route-name">${escapeHtml(entityLabel)}</span>
      <span class="hud-route-span">${span ? escapeHtml(span) + ' · ' : ''}${pts.length} ${word}</span>
    </div>
    <ol class="hud-route-strip">${rows}</ol>
  </div>`;
}

function buildSecretRingHTML(kCount, total) {
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((kCount / total) * 100))) : 0;
  return `<div class="hud-secret-spread">
    <svg class="hud-secret-ring" viewBox="0 0 36 36" aria-hidden="true">
      <circle class="hud-secret-ring-bg" cx="18" cy="18" r="15.5" pathLength="100"/>
      <circle class="hud-secret-ring-fg" cx="18" cy="18" r="15.5" pathLength="100" stroke-dasharray="${pct} 100" transform="rotate(-90 18 18)"/>
    </svg>
    <div class="hud-secret-spread-meta"><span>ЗНАЮТ</span><b>${kCount} / ${total}</b><small>${pct}%</small></div>
  </div>`;
}

export function buildMemoryHTML(memoryData, uid, isChecked, hudData, extra = {}) {
  if (!memoryData || typeof memoryData !== 'object') memoryData = {};
  let html = `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}"><div class="hud-memory-body hud-memory-scroll" style="grid-template-columns: 1fr;">`;
  // Сводка «что о тебе думают» живёт во вкладке игрока; когда той нет — здесь.
  if (extra && extra.perception) html += extra.perception;

  // Граф отношений — изолирован от остальных блоков памяти.
  // Любая неожиданная ошибка в данных Rel/узла не должна прерывать рендер
  // таймлайна, маршрутов, эмоций, важных фактов и секретов ниже.
  // Сам рисунок собирается, когда слот показался на экране (render/lazy-svg.js).
  try {
    const сломан = `<div class="hud-memory-relgraph-error" role="status">🕸 Граф отношений временно недоступен</div>`;
    const граф = () => { try { return buildRelGraphHTML(hudData || {}, uid) || ''; } catch (e) { console.warn('[TavernOS HUD] Relationship graph render failed:', e); return сломан; } };
    const relGraphHtml = hudHasRelations(hudData || {}) ? отложитьРисунок(uid + '-relgraph', граф, 320) : '';
    if (relGraphHtml) html += `<div class="hud-memory-relgraph-slot">${relGraphHtml}</div>`;
  } catch (e) {
    console.warn('[TavernOS HUD] Relationship graph render failed; continuing memory render:', e);
    html += `<div class="hud-memory-relgraph-error" role="status">🕸 Граф отношений временно недоступен</div>`;
  }

  // 1. ТАЙМЛАЙН (Вертикальная линия)
  try {
  if (Array.isArray(memoryData.timeline) && memoryData.timeline.length > 0) {
    const пункты = memoryData.timeline.map(item => {
      let text = String(item).trim().replace(/\.$/, '');
      let timeMatch = text.match(/^\[?([\d]{1,2}\s*:\s*\d{2})\]?\s*[-—–:]?\s*(.*)$/);
      return timeMatch
          ? `<div class="hud-timeline-item"><div class="hud-timeline-time">${escapeHtml(timeMatch[1])}</div><div class="hud-timeline-content">${applyTooltips(timeMatch[2])}</div></div>`
          : `<div class="hud-timeline-item"><div class="hud-timeline-content">${applyTooltips(text)}</div></div>`;
    });
    html += `<div class="hud-row full-width"><span class="hud-key">⏳ Таймлайн:</span> ${длинныйСписок(пункты, 'hud-timeline-container', 'ранние события')}</div>`;
  }
  } catch (e) { console.warn('[TavernOS HUD] Memory timeline render failed:', e); }

  // 2. МАРШРУТЫ (Связанные узлы пути)
  const buildRouteHTML = (routeArr, entityLabel) => {
      if (!routeArr || routeArr.length === 0) return '';
      return видМаршрута(routeArr.map(parseRoutePoint), entityLabel, видБлока('routeView')) || buildRouteMapHTML(routeArr, entityLabel);
  };

  // Имя персонажа для подписей. Раньше маршрут его вычислял, а блок эмоций
  // рядом писал жёстко «NPC» — в интерфейсе с именем игрока это выглядело
  // как безымянный служебный ярлык. Считаем один раз на оба места.
  const charLabel = (hudData && hudData.characters && hudData.characters[0]
    && (hudData.characters[0]['Имя'] || hudData.characters[0].N)) || 'Персонаж';

  if (memoryData.route && (memoryData.route.user?.length > 0 || memoryData.route.char?.length > 0)) {
    let routeHtml = '';
    if (memoryData.route.user?.length > 0) routeHtml += buildRouteHTML(memoryData.route.user, getSafeUserName());
    if (memoryData.route.char?.length > 0) {
      routeHtml += buildRouteHTML(memoryData.route.char, charLabel);
    }
    html += `<div class="hud-row full-width"><span class="hud-key">🗺️ Мини-карта маршрутов:</span> ${routeHtml}</div>`;
  }

  // 3. ЭМОЦИИ (Горизонтальные чипы с прокруткой)
  const buildMoodHTML = (historyArr, currentMood, entityLabel) => {
      if (!currentMood && (!historyArr || historyArr.length === 0)) return '';
      let mHtml = `<div class="hud-mood-group"><div class="hud-mood-current">${escapeHtml(entityLabel)}${currentMood ? `: <span style="font-weight:normal; opacity:0.9;">${escapeHtml(currentMood)}</span>` : ''}</div><div class="hud-mood-history">`;
      (historyArr || []).forEach(item => {
           let match = String(item).match(/^\[?([\d]{1,2}\s*:\s*\d{2})\]?\s*[-—–:]?\s*(.*)$/);
           mHtml += match
               ? `<div class="hud-mood-chip"><span class="hud-mood-chip-time">${escapeHtml(match[1])}</span><span class="hud-mood-chip-val">${escapeHtml(match[2])}</span></div>`
               : `<div class="hud-mood-chip"><span class="hud-mood-chip-val">${escapeHtml(item)}</span></div>`;
      });
      return mHtml + `</div></div>`;
  };

  if (memoryData.mood && (memoryData.mood.user?.current || memoryData.mood.char?.current || memoryData.mood.user?.history?.length > 0)) {
    let moodHtml = '';
    moodHtml += buildMoodHTML(memoryData.mood.user?.history, memoryData.mood.user?.current, getSafeUserName());
    moodHtml += buildMoodHTML(memoryData.mood.char?.history, memoryData.mood.char?.current, charLabel);
    html += `<div class="hud-row full-width" style="overflow:hidden;"><span class="hud-key">🎭 Эмоции:</span> ${moodHtml}</div>`;
  }

  if (Array.isArray(memoryData.important) && memoryData.important.length > 0) {
    // Каждый пункт можно унести в Lorebook: это ровно тот сорт фактов, что
    // должен пережить откат чата и остаться в мире.
    const важное = memoryData.important.map(item => {
      const isNew = isNewLoreItem(item);
      return `<div class="hud-detail-pill drama-alert hud-lore-item${isNew ? ' is-new' : ''}">` +
        `<span class="hud-lore-text">${escapeHtml(String(item))}</span>` +
        loreButtonHTML(item, [], isNew) + `</div>`;
    });
    html += `<div class="hud-row full-width"><span class="hud-key">❗ Важное:</span> ${длинныйСписок(важное, 'hud-vertical-container', 'ранние')}</div>`;
  }
  if (Array.isArray(memoryData.recently_learned) && memoryData.recently_learned.length > 0) {
    html += `<div class="hud-row full-width"><span class="hud-key">💡 Недавно узнали:</span> <div class="hud-vertical-container">${buildPillList(memoryData.recently_learned.join('; '), 'hud-detail-pill')}</div></div>`;
  }
  if (Array.isArray(memoryData.unknown) && memoryData.unknown.length > 0) {
    html += `<div class="hud-row full-width"><span class="hud-key">❓ Чего герои не знают:</span> <div class="hud-vertical-container">${buildPillList(memoryData.unknown.join('; '), 'hud-detail-pill')}</div></div>`;
  }

  // Ружья Чехова: незакрытые нити. Строка «завязка | к кому относится | статус».
  const ружьяИначе = Array.isArray(memoryData.guns) && memoryData.guns.length ? видРужей(memoryData.guns, видБлока('gunsView')) : '';
  if (ружьяИначе) html += `<div class="hud-row full-width"><span class="hud-key">🔫 Ружья Чехова:</span> ${ружьяИначе}</div>`;
  else if (Array.isArray(memoryData.guns) && memoryData.guns.length > 0) {
    const ружья = memoryData.guns.map(строка => {
      const [завязка = '', кто = '', статусСырой = ''] = String(строка).split('|').map(s => s.trim());
      if (!завязка) return '';
      const с = статусРужья(статусСырой);
      const значок = с.ключ === 'fired' ? '💥' : с.ключ === 'building' ? '⏳' : '🔫';
      // В Lorebook — завязка, с кем связана и где нить сейчас. Ключи — имена из
      // «к кому относится»: по ним запись всплывёт, когда нить снова в сцене.
      const ключи = кто.split(/[;,]|\s+и\s+/).map(x => x.trim()).filter(Boolean);
      const запись = [завязка, кто ? 'Связано с: ' + кто : '', 'Статус: ' + с.текст].filter(Boolean).join('\n');
      const новое = isNewLoreItem(завязка);
      return `<div class="hud-gun is-${с.ключ} hud-lore-item${новое ? ' is-new' : ''}"><span class="hud-gun-ico" aria-hidden="true">${значок}</span>`
        + `<div class="hud-gun-body"><p>${applyTooltips(завязка)}</p>${кто ? `<small>${escapeHtml(кто)}</small>` : ''}</div>`
        + `<em class="hud-gun-status">${escapeHtml(с.текст)}</em>`
        + loreButtonHTML(запись, ключи, новое) + `</div>`;
    }).filter(Boolean).join('');
    if (ружья) html += `<div class="hud-row full-width"><span class="hud-key">🔫 Ружья Чехова:</span> <div class="hud-guns">${ружья}</div></div>`;
  }

  // 4. СЕКРЕТЫ (Кастомный скрытый спойлер + Уровни)
  const секретыИначе = Array.isArray(memoryData.secrets) && memoryData.secrets.length ? видСекретов(memoryData.secrets, видБлока('secretsView')) : '';
  if (секретыИначе) html += `<div class="hud-row full-width"><span class="hud-key">🤫 Зашифрованные данные:</span> ${секретыИначе}</div>`;
  else if (Array.isArray(memoryData.secrets) && memoryData.secrets.length > 0) {
    let secHtml = memoryData.secrets.map(s => {
       let lvlStr = String(s.level || '').toLowerCase();
       let lvlText = '🔒 СЕКРЕТ'; let lvlClass = 'lvl-secret';
       if(lvlStr.includes('high')) { lvlText = '🔐 СТРОГО СЕКРЕТНО'; lvlClass = 'lvl-high'; }
       if(lvlStr.includes('crit')) { lvlText = '☠ ОСОБОЙ ВАЖНОСТИ'; lvlClass = 'lvl-critical'; }

       let statStr = String(s.status || '').toLowerCase();
       let statText = '🔴 НЕ РАСКРЫТ'; let statClass = 'stat-unknown';
       // «unknown» содержит «known»: проверяем его первым, иначе нераскрытый
       // секрет показывался известным.
       if (!/unknown|неизвест/.test(statStr)) {
         if (/suspect|подозр/.test(statStr)) { statText = '🟡 ПОДОЗРЕВАЮТ'; statClass = 'stat-suspected'; }
         else if (/part|частич/.test(statStr)) { statText = '🟠 ЧАСТИЧНО'; statClass = 'stat-known'; }
         else if (/known|извест/.test(statStr)) { statText = '🟢 ИЗВЕСТЕН'; statClass = 'stat-known'; }
       }

       const unawareValue = s.unaware ?? s.hidden;
       const имяЧеловека = (x) => String((x && typeof x === 'object' ? (x.name || x.who) : x) || '').trim();
       const пустое = (n) => !n || /^(none|empty|null|нет|никто|-|—)$/i.test(n);
       // Каждого считаем один раз; знающий не может быть и в неведении.
       const уникальные = (список, исключить) => {
         const было = new Set(исключить);
         return список.filter(x => { const n = имяЧеловека(x).toLowerCase(); if (пустое(n) || было.has(n)) return false; было.add(n); return true; });
       };
       const списком = (v) => (Array.isArray(v) ? v : (v ? [v] : []));
       const знающие = уникальные(списком(s.knows), []);
       const знают = знающие.map(x => имяЧеловека(x).toLowerCase());
       const незнающие = уникальные(списком(unawareValue), знают);
       let kCount = знающие.length;
       let uCount = незнающие.length;
       let total = kCount + uCount;
       let spreadText = total > 0 ? buildSecretRingHTML(kCount, total) : '';

       let knowsArr = знающие.filter(x => x && typeof x === 'object' || Array.isArray(s.knows));
       let unawareArr = незнающие;
       let knowsHtml = knowsArr.length > 0
           ? knowsArr.map(k => `<div class="hud-secret-person"><span class="hud-secret-pname">✔ ${escapeHtml(k.name || k)}</span> ${k.source ? `<span class="hud-secret-psource">${escapeHtml(k.source)}</span>` : ''}</div>`).join('')
           : '<div class="hud-secret-person" style="opacity:0.6;">Никто не знает</div>';
       let unawareHtml = unawareArr.length > 0
           ? unawareArr.map(u => `<div class="hud-secret-person unaware"><span class="hud-secret-pname">✖ ${escapeHtml(u.name || u)}</span></div>`).join('')
           : '';

       // Текст для Lorebook: факт, круг посвящённых с их пояснениями и те,
       // кто не в курсе. Пояснение к имени («откуда узнал») — самое ценное
       // в секрете после самого факта, без него запись пересказывает половину.
       const loreLines = [String(s.fact || '').trim()];
       if (knowsArr.length) {
         loreLines.push('Знают: ' + knowsArr.map(k => {
           const nm = String((k && k.name) || k || '').trim();
           const src = String((k && k.source) || '').trim();
           return src ? nm + ' (' + src + ')' : nm;
         }).filter(Boolean).join('; '));
       } else {
         loreLines.push('Знают: никто');
       }
       if (unawareArr.length) {
         loreLines.push('Не знают: ' + unawareArr.map(u => String((u && u.name) || u || '').trim()).filter(Boolean).join('; '));
       }
       if (lvlText) loreLines.push('Уровень: ' + lvlText.replace(/^[^\s]+\s/, ''));
       const loreContent = loreLines.join('\n');
       // Ключи — все, кто в этом секрете замешан: и знающие, и незнающие.
       const loreKeys = [...knowsArr, ...unawareArr].map(x => String((x && x.name) || x || '').trim()).filter(Boolean);

       return `
       <details class="hud-secret-details">
          <summary class="hud-secret-summary ${lvlClass}">
              <div class="hud-secret-header">
                  <span class="hud-secret-lvl"><span class="hud-secret-lock"><span class="lck">🔒</span><span class="unl">🔓</span></span> ${lvlText}</span>
                  <span class="hud-secret-stat ${statClass}">${statText}</span>
              </div>
              ${spreadText}
          </summary>
          <div class="hud-secret-body">
              <div class="hud-secret-head-row">
                <div class="hud-secret-title">${escapeHtml(s.fact)}</div>
                ${loreButtonHTML(loreContent, loreKeys, isNewLoreItem(s.fact))}
              </div>
              <div class="hud-secret-cols">
                  <div class="hud-secret-col">
                      <div class="hud-secret-col-title">В КУРСЕ:</div>
                      ${knowsHtml}
                  </div>
                  ${unawareArr.length > 0 ? `
                  <div class="hud-secret-col">
                      <div class="hud-secret-col-title">В НЕВЕДЕНИИ:</div>
                      ${unawareHtml}
                  </div>` : ''}
              </div>
          </div>
       </details>`;
    }).join('');
    html += `<div class="hud-row full-width"><span class="hud-key">🤫 Зашифрованные данные:</span> <div class="hud-vertical-container" style="max-height: none;">${secHtml}</div></div>`;
  }

  return html + `</div></div>`;
}
