// hud-manager/render/dreams.js
//
// Домен «Сны»: пузыри, треснувшее стекло и записи сновидений.
// Вынесено из index.js без изменения поведения.

import { escapeHtml, hudHasMeaningfulValue } from '../utils.js?v=22.5.8';

export function buildDreamBubblesHtml() {
  let bubbles = '';
  for (let i = 1; i <= 5; i++) bubbles += `<span class="hud-dream-bubble b${i}"></span>`;
  return `<div class="hud-dream-haze"></div><div class="hud-dream-bubbles">${bubbles}</div>`;
}

export function buildDreamGlassHtml() {
  return `<div class="hud-dream-glass" aria-hidden="true">
    <div class="hud-dream-pane"></div>
    <svg class="hud-dream-cracks" viewBox="0 0 100 100" preserveAspectRatio="none">
      <g class="crack-set c1">
        <path d="M52 0 L48 22 L44 48"/>
        <path d="M48 22 L76 30"/>
        <path d="M48 22 L18 38"/>
      </g>
      <g class="crack-set c2">
        <path d="M44 48 L38 100"/>
        <path d="M44 48 L72 74 L94 100"/>
        <path d="M18 38 L0 54"/>
        <path d="M76 30 L100 24"/>
        <path d="M76 30 L90 62"/>
        <path d="M48 22 L62 8"/>
      </g>
      <g class="crack-set c3">
        <path d="M38 100 L14 82 L0 100"/>
        <path d="M72 74 L54 96"/>
        <path d="M18 38 L8 14 L0 10"/>
        <path d="M90 62 L100 86"/>
        <path d="M44 48 L28 62"/>
        <path d="M76 30 L68 12"/>
      </g>
    </svg>
    <span class="hud-dream-shard sh1"></span><span class="hud-dream-shard sh2"></span><span class="hud-dream-shard sh3"></span>
    <span class="hud-dream-shard sh4"></span><span class="hud-dream-shard sh5"></span><span class="hud-dream-shard sh6"></span>
    <span class="hud-dream-shard sh7"></span><span class="hud-dream-shard sh8"></span>
  </div>`;
}

export function buildDreamHTML(dreamsData, uid, isChecked) {
  let html = `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}"><div class="hud-dream-container"><div class="hud-dream-moon">🌙 Z z z . . .</div>`;
  if (!dreamsData || dreamsData.length === 0) {
    return html + `<div class="hud-dream-bubble"><div class="hud-dream-text">Снов пока нет</div><div class="hud-dream-meaning">Раздел активен, но в текущем HUD нет записей.</div></div></div></div>`;
  }
  dreamsData.forEach(dream => { 
    html += `<div class="hud-dream-entry" data-crack="0">${buildDreamBubblesHtml()}${buildDreamGlassHtml()}<div class="hud-dream-text">✨ ${escapeHtml(dream.text)}</div>`;
    if (dream.meaning && dream.meaning.toLowerCase() !== 'none' && dream.meaning.toLowerCase() !== 'empty') html += `<div class="hud-dream-meaning"><span class="hud-dream-meaning-label">🔮 Смысл:</span> ${escapeHtml(dream.meaning)}</div>`;
    html += `</div>`; 
  });
  return html + `</div></div>`;
}

export function hudHasMeaningfulDreams(items) {
  return Array.isArray(items) && items.some(i => {
    if (typeof i === 'string') return hudHasMeaningfulValue(i);
    if (!i || typeof i !== 'object') return false;
    return hudHasMeaningfulValue(i.text);
  });
}
