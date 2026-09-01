// hud-manager/render/memory.js
//
// Домен «Память»: таймлайн, настроение, маршрут дня, кольцо секретов и
// сборка HTML вкладки. Вынесено из index.js без изменения поведения.
//
// Вкладка памяти встраивает граф отношений, поэтому модуль зависит от
// ./relations-graph.js.

import { escapeHtml, applyTooltips, buildPillList, getSafeUserName, hudHashSeed } from '../utils.js';
import { buildRelGraphHTML } from './relations-graph.js';

export function parseRoutePoint(item) {
  const parts = String(item).split(/[-—–]/).map(s => s.trim());
  const time = parts[0] || '';
  const place = parts[1] || '';
  const action = parts.slice(2).join(' — ') || '';
  if (time.match(/^\[?[\d]{1,2}\s*:\s*\d{2}\]?$/)) return { time, place: place || String(item), action };
  return { time: '', place: String(item), action: '' };
}

export function buildRouteMapHTML(routeArr, entityLabel) {
  if (!routeArr || routeArr.length === 0) return '';
  const pts = routeArr.map(parseRoutePoint);
  const W = 320, H = 150;
  const coords = pts.map((p, i) => {
    const h = hudHashSeed(p.place + ':' + p.time + ':' + i);
    const t = pts.length === 1 ? 0.5 : i / (pts.length - 1);
    const x = 22 + t * (W - 44) + ((h % 13) - 6);
    const y = 36 + (h % 68) + (i % 2 ? 8 : -4);
    return { x: Math.max(18, Math.min(W - 18, x)), y: Math.max(22, Math.min(H - 28, y)), p, i };
  });
  const poly = coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  let svg = `<div class="hud-route-map" title="Наведи или нажми, чтобы проиграть путь">
    <div class="hud-route-name">${escapeHtml(entityLabel)}</div>
    <svg viewBox="0 0 ${W} ${H}" class="hud-route-svg" role="img">
      <rect class="hud-route-map-bg" x="4" y="4" width="${W - 8}" height="${H - 8}" rx="10"/>
      <polyline class="hud-route-map-line-static" points="${poly}" fill="none"/>
      <polyline class="hud-route-map-line" points="${poly}" fill="none"/>`;
  coords.forEach((c, i) => {
    const last = i === coords.length - 1;
    const label = (c.p.place || '').slice(0, 16);
    svg += `<circle class="hud-route-map-dot${last ? ' current' : ''}" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${last ? 5.5 : 3.5}"/>`;
    svg += `<text class="hud-route-map-label" x="${c.x.toFixed(1)}" y="${(c.y - 8).toFixed(1)}" text-anchor="middle">${escapeHtml(label)}</text>`;
  });
  svg += `</svg></div>`;
  return svg;
}

export function buildSecretRingHTML(kCount, total) {
  const pct = total > 0 ? Math.round((kCount / total) * 100) : 0;
  return `<div class="hud-secret-spread">
    <svg class="hud-secret-ring" viewBox="0 0 36 36" aria-hidden="true">
      <circle class="hud-secret-ring-bg" cx="18" cy="18" r="15.5" pathLength="100"/>
      <circle class="hud-secret-ring-fg" cx="18" cy="18" r="15.5" pathLength="100" stroke-dasharray="${pct} 100" transform="rotate(-90 18 18)"/>
    </svg>
    <div class="hud-secret-spread-meta"><span>KNOWLEDGE</span><b>${kCount} / ${total}</b><small>${pct}%</small></div>
  </div>`;
}

export function buildMemoryHTML(memoryData, uid, isChecked, hudData) {
  if (!memoryData || typeof memoryData !== 'object') memoryData = {};
  let html = `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}"><div class="hud-memory-body hud-memory-scroll" style="grid-template-columns: 1fr;">`;

  // Граф отношений — изолирован от остальных блоков памяти.
  // Любая неожиданная ошибка в данных Rel/узла не должна прерывать рендер
  // таймлайна, маршрутов, эмоций, важных фактов и секретов ниже.
  try {
    const relGraphHtml = buildRelGraphHTML(hudData || {}, uid);
    if (relGraphHtml) html += `<div class="hud-memory-relgraph-slot">${relGraphHtml}</div>`;
  } catch (e) {
    console.warn('[TavernOS HUD] Relationship graph render failed; continuing memory render:', e);
    html += `<div class="hud-memory-relgraph-error" role="status">🕸 Граф отношений временно недоступен</div>`;
  }

  // 1. ТАЙМЛАЙН (Вертикальная линия)
  try {
  if (Array.isArray(memoryData.timeline) && memoryData.timeline.length > 0) {
    let evHtml = memoryData.timeline.map(item => {
      let text = String(item).trim().replace(/\.$/, '');
      let timeMatch = text.match(/^\[?([\d]{1,2}\s*:\s*\d{2})\]?\s*[-—–:]?\s*(.*)$/);
      return timeMatch
          ? `<div class="hud-timeline-item"><div class="hud-timeline-time">${escapeHtml(timeMatch[1])}</div><div class="hud-timeline-content">${applyTooltips(timeMatch[2])}</div></div>`
          : `<div class="hud-timeline-item"><div class="hud-timeline-content">${applyTooltips(text)}</div></div>`;
    }).join('');
    html += `<div class="hud-row full-width"><span class="hud-key">⏳ Таймлайн:</span> <div class="hud-timeline-container">${evHtml}</div></div>`;
  }
  } catch (e) { console.warn('[TavernOS HUD] Memory timeline render failed:', e); }

  // 2. МАРШРУТЫ (Связанные узлы пути)
  const buildRouteHTML = (routeArr, entityLabel) => {
      if (!routeArr || routeArr.length === 0) return '';
      return buildRouteMapHTML(routeArr, entityLabel);
  };

  if (memoryData.route && (memoryData.route.user?.length > 0 || memoryData.route.char?.length > 0)) {
    let routeHtml = '';
    if (memoryData.route.user?.length > 0) routeHtml += buildRouteHTML(memoryData.route.user, getSafeUserName());
    if (memoryData.route.char?.length > 0) {
      const charLabel = (hudData && hudData.characters && hudData.characters[0] && (hudData.characters[0]['Имя'] || hudData.characters[0].N)) || 'NPC';
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
    moodHtml += buildMoodHTML(memoryData.mood.char?.history, memoryData.mood.char?.current, 'NPC');
    html += `<div class="hud-row full-width" style="overflow:hidden;"><span class="hud-key">🎭 Эмоции:</span> ${moodHtml}</div>`;
  }

  if (Array.isArray(memoryData.important) && memoryData.important.length > 0) {
    html += `<div class="hud-row full-width"><span class="hud-key">❗ Важное:</span> <div class="hud-vertical-container">${buildPillList(memoryData.important.join('; '), 'hud-detail-pill drama-alert')}</div></div>`;
  }
  if (Array.isArray(memoryData.recently_learned) && memoryData.recently_learned.length > 0) {
    html += `<div class="hud-row full-width"><span class="hud-key">💡 Недавно узнали:</span> <div class="hud-vertical-container">${buildPillList(memoryData.recently_learned.join('; '), 'hud-detail-pill')}</div></div>`;
  }
  if (Array.isArray(memoryData.unknown) && memoryData.unknown.length > 0) {
    html += `<div class="hud-row full-width"><span class="hud-key">❓ Чего герои не знают:</span> <div class="hud-vertical-container">${buildPillList(memoryData.unknown.join('; '), 'hud-detail-pill')}</div></div>`;
  }

  // 4. СЕКРЕТЫ (Кастомный скрытый спойлер + Уровни)
  if (Array.isArray(memoryData.secrets) && memoryData.secrets.length > 0) {
    let secHtml = memoryData.secrets.map(s => {
       let lvlStr = String(s.level || '').toLowerCase();
       let lvlText = '🔒 SECRET'; let lvlClass = 'lvl-secret';
       if(lvlStr.includes('high')) { lvlText = '🔐 HIGHLY SECRET'; lvlClass = 'lvl-high'; }
       if(lvlStr.includes('crit')) { lvlText = '☠ CLASSIFIED'; lvlClass = 'lvl-critical'; }

       let statStr = String(s.status || '').toLowerCase();
       let statText = '🔴 UNKNOWN'; let statClass = 'stat-unknown';
       if(statStr.includes('suspect')) { statText = '🟡 SUSPECTED'; statClass = 'stat-suspected'; }
       if(statStr.includes('part') || statStr.includes('known')) { statText = '🟢 KNOWN'; statClass = 'stat-known'; }

       let kCount = Array.isArray(s.knows) ? s.knows.length : (s.knows && s.knows !== 'none' ? 1 : 0);
       const unawareValue = s.unaware ?? s.hidden;
       let uCount = Array.isArray(unawareValue) ? unawareValue.length : (unawareValue && unawareValue !== 'none' ? 1 : 0);
       let total = kCount + uCount;
       let spreadText = total > 0 ? buildSecretRingHTML(kCount, total) : '';

       let knowsArr = Array.isArray(s.knows) ? s.knows : [];
       let unawareArr = Array.isArray(unawareValue) ? unawareValue : [];
       let knowsHtml = knowsArr.length > 0
           ? knowsArr.map(k => `<div class="hud-secret-person"><span class="hud-secret-pname">✔ ${escapeHtml(k.name || k)}</span> ${k.source ? `<span class="hud-secret-psource">${escapeHtml(k.source)}</span>` : ''}</div>`).join('')
           : '<div class="hud-secret-person" style="opacity:0.6;">Никто не знает</div>';
       let unawareHtml = unawareArr.length > 0
           ? unawareArr.map(u => `<div class="hud-secret-person unaware"><span class="hud-secret-pname">✖ ${escapeHtml(u.name || u)}</span></div>`).join('')
           : '';

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
              <div class="hud-secret-title">${escapeHtml(s.fact)}</div>
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
