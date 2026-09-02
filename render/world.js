// hud-manager/render/world.js
//
// Домен «Мир»: заголовки новостей, слухи, объявления и комментарии
// с голосованием. Вынесено из index.js без изменения поведения.
//
// Единственное отличие от оригинала: buildWorldHTML раньше читал
// settings.showComments напрямую из замыкания index.js. Теперь флаг
// приходит четвёртым аргументом — модуль не знает про глобальные настройки.

import { escapeHtml, hudHashSeed, commentInitials, hudHasMeaningfulValue } from '../utils.js?v=22.7.1';
import { HUD_AVATAR_COLORS } from '../avatars.js?v=22.7.1';

const worldVoteState = Object.create(null);

export function getWorldVotes(key) {
  if (!worldVoteState[key]) {
    const seed = hudHashSeed(key);
    worldVoteState[key] = {
      up: 40 + (seed % 380),
      comments: 8 + ((seed >> 3) % 90),
      votedUp: false,
      votedC: false
    };
  }
  return worldVoteState[key];
}

export function parseWorldComment(raw) {
  const text = String(raw || '').trim();
  const m = text.match(/^([^:]{1,48}):\s*([\s\S]*)$/);
  if (m && m[2].trim()) return { name: m[1].trim(), text: m[2].trim() };
  return { name: 'Анон', text };
}

export function buildWorldHTML(worldData, uid, isChecked, showComments) {
  let html = `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}"><div class="hud-world-container"><div class="hud-world-scroll">`;
  if (!worldData || !Object.values(worldData).some(arr => Array.isArray(arr) && arr.length > 0)) {
    return html + `<div class="hud-world-empty">🌍 В этом снимке мира пока нет записей.</div></div></div>`;
  }
  const headlineTitles = [];
  if (worldData.headlines && worldData.headlines.length > 0) {
    html += `<div class="hud-world-section hud-world-section-news"><div class="hud-world-title">📰 Главные новости</div>`;
    worldData.headlines.forEach((hl, idx) => {
      const parts = String(hl).split('|');
      const title = parts[0].trim();
      const body = parts.length > 1 ? parts.slice(1).join('|').trim() : '';
      headlineTitles.push(title);
      const voteKey = `hl-${idx}-${hudHashSeed(title + '\n' + body)}`;
      const votes = getWorldVotes(voteKey);
      const colClass = body.length > 220 ? ' article-text-columns' : '';
      html += `<details class="hud-news-article">
        <summary><span class="hud-news-headline">${escapeHtml(title)}</span>
          <span class="hud-news-stats">
            <button type="button" class="hud-news-vote hud-news-upvote${votes.votedUp ? ' is-on' : ''}" data-vote-key="${voteKey}" data-vote-kind="up" aria-pressed="${votes.votedUp ? 'true' : 'false'}">▲ <span class="hud-news-vote-n">${votes.up}</span></button>
            <span class="hud-news-stats-sep">|</span>
            <button type="button" class="hud-news-vote hud-news-cmt${votes.votedC ? ' is-on' : ''}" data-vote-key="${voteKey}" data-vote-kind="comments" aria-pressed="${votes.votedC ? 'true' : 'false'}">💬 <span class="hud-news-vote-n">${votes.comments}</span></button>
          </span>
        </summary>
        <div class="article-text${colClass}">${escapeHtml(body)}</div>
      </details>`;
    });
    html += `</div>`;
  }
  if (worldData.rumors && worldData.rumors.length > 0) {
    html += `<div class="hud-world-section"><div class="hud-world-title">🗣️ Слухи</div><ul class="hud-world-list">`;
    worldData.rumors.forEach(r => html += `<li>${escapeHtml(r)}</li>`);
    html += `</ul></div>`;
  }
  if (worldData.ads && worldData.ads.length > 0) {
    html += `<div class="hud-world-section hud-world-section-ads"><div class="hud-world-title">📌 Доска объявлений</div><div class="hud-ads-grid">`;
    worldData.ads.forEach((ad, i) => html += `<div class="hud-ad-card hud-ad-neon n${(i % 4) + 1}">${escapeHtml(ad)}</div>`);
    html += `</div></div>`;
  }
  if (worldData.comments && worldData.comments.length > 0 && showComments) {
    html += `<div class="hud-world-section"><div class="hud-world-title">💬 Комментарии Сети</div><div class="hud-comments-list">`;
    worldData.comments.forEach(c => {
      const parsed = parseWorldComment(c);
      const color = HUD_AVATAR_COLORS[hudHashSeed(parsed.name) % HUD_AVATAR_COLORS.length];
      html += `<div class="hud-comment"><span class="hud-comment-avatar" style="background:${color}" aria-hidden="true">${escapeHtml(commentInitials(parsed.name))}</span><div class="hud-comment-body"><span class="hud-comment-name">${escapeHtml(parsed.name)}</span><span class="hud-comment-text">${escapeHtml(parsed.text)}</span></div></div>`;
    });
    html += `</div></div>`;
  }
  html += `</div>`;
  if (headlineTitles.length > 0) {
    const seq = headlineTitles.map(t => `<span class="hud-breaking-item">${escapeHtml(t)}</span>`).join('<span class="hud-breaking-dot">◆</span>');
    const loop = `<span class="hud-breaking-seq">${seq}<span class="hud-breaking-dot">◆</span></span>`;
    html += `<div class="hud-breaking-news" aria-hidden="true"><span class="hud-breaking-label">📺 BREAKING</span><div class="hud-breaking-track"><div class="hud-breaking-marquee">${loop}${loop}</div></div></div>`;
  }
  return html + `</div></div>`;
}

export function hudHasMeaningfulWorld(world) {
  return !!(world && typeof world === 'object' && Object.values(world).some(arr =>
    Array.isArray(arr) && arr.some(hudHasMeaningfulValue)
  ));
}
