// hud-manager/render/relations-graph.js
//
// Домен «Граф отношений»: разбор списка связей, сборка узлов и рёбер,
// SVG-рендер, инспектор, фокус и разворот на весь экран.
// Вынесено из index.js без изменения поведения.
//
// index.js импортирует отсюда hudHasRelations, applyRelGraphFocus и
// setRelGraphExpandedState; render/memory.js — buildRelGraphHTML.

import { escapeHtml, hudFilled, hudHashSeed, commentInitials, getSafeUserName } from '../utils.js?v=22.51.0';
import { getAvatarUrl, getUserAvatarUrl, HUD_AVATAR_COLORS } from '../avatars.js?v=22.51.0';
import { normalizeNameText, nameLettersOnly, namePhoneticLatin, namesLikelySame } from '../names.js?v=22.51.0';

function hudRelField(obj) {
  if (!obj || typeof obj !== 'object') return '';
  for (const key of ['Отношения','отношения','Rel','rel','Relationship','relationship','Relationships','relationships','Relation','relation','Связи','связи','Связь','связь','Feelings','feelings','Чувства','чувства']) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && hudFilled(obj[key])) return obj[key];
  }
  return '';
}

function parseRelationList(raw) {
  if (!hudFilled(raw)) return [];
  const source = String(raw)
    .replace(/[•●▪◦]/g, ';')
    .replace(/\r\n?/g, '\n')
    .replace(/\n+/g, ';')
    .replace(/\s+\|\s+/g, ';');
  return source.split(';').map(p => p.trim()).filter(Boolean).map(p => {
    let m = p.match(/^\s*["'«]?([^:"'«»]+?)["'»]?\s*:\s*(.+)$/);
    if (!m) m = p.match(/^\s*([^→>-]+?)\s*(?:→|->|—|–|-|=>)\s*(.+)$/);
    if (!m) return null;
    return { target: m[1].trim(), rel: m[2].trim() };
  }).filter(item => item && hudFilled(item.target) && hudFilled(item.rel));
}

export function mergeCharacterRecords(characters) {
  const merged = [];
  for (const original of Array.isArray(characters) ? characters : []) {
    if (!original || typeof original !== 'object') continue;
    const current = { ...original };
    const rawName = current.N || current['Имя'] || current.name || current.Name || '';
    if (!hudFilled(rawName)) {
      merged.push(current);
      continue;
    }
    const existing = merged.find(x => namesLikelySame(rawName, x.N || x['Имя'] || x.name || x.Name || ''));
    if (!existing) {
      current.N = rawName;
      merged.push(current);
      continue;
    }
    // Сохраняем каноническое имя первого профиля, но объединяем все данные.
    for (const [key, value] of Object.entries(current)) {
      if (key === 'N' || key === 'Имя' || key === 'name' || key === 'Name') continue;
      const old = existing[key];
      const newFilled = hudFilled(value) && !/^empty$/i.test(String(value).trim());
      const oldFilled = hudFilled(old) && !/^empty$/i.test(String(old).trim());
      if (!oldFilled && newFilled) existing[key] = value;
      else if (key === 'Rel' || key === 'rel' || key === 'Отношения' || key === 'отношения') {
        const parts = [old, value].filter(v => hudFilled(v)).map(v => String(v).trim()).filter(Boolean);
        const unique = [];
        for (const part of parts) for (const rel of parseRelationList(part)) {
          const signature = `${nameIdentityKey(rel.target)}::${rel.rel.toLowerCase()}`;
          if (!unique.some(x => x.sig === signature)) unique.push({ sig: signature, text: `${rel.target}: ${rel.rel}` });
        }
        if (unique.length) existing.Rel = unique.map(x => x.text).join('; ');
      }
    }
  }
  return merged;
}

function nameIdentityKey(name) {
  const s = namePhoneticLatin(name);
  return s || nameLettersOnly(name) || normalizeNameText(name);
}

function collectRelationGraph(hudData) {
  const nodes = [];
  const byKey = new Map();
  const resolveExisting = (label) => {
    const clean = String(label || '').trim();
    if (!clean) return null;
    for (const node of nodes) if (namesLikelySame(clean, node.name)) return node;
    return null;
  };
  const addNode = (name, flags) => {
    const label = String(name || '').trim();
    if (!hudFilled(label)) return '';
    const existing = resolveExisting(label);
    if (existing) {
      if (flags?.isUser) existing.isUser = true;
      if (flags?.isPrimary) existing.isPrimary = true;
      return existing.id;
    }
    const keyBase = nameIdentityKey(label);
    let key = keyBase || label.toLowerCase();
    let suffix = 2;
    while (byKey.has(key)) key = `${keyBase}-${suffix++}`;
    const node = { id: key, name: label, isUser: !!flags?.isUser, isPrimary: !!flags?.isPrimary };
    byKey.set(key, node);
    nodes.push(node);
    return key;
  };
  const edges = [];
  const userName = getSafeUserName();

  addNode(userName, { isUser: true });
  (hudData.characters || []).forEach((c, i) => addNode(c && (c['Имя'] || c.N || c.name || c.Name), { isPrimary: i === 0 }));

  const addEdgesFrom = (fromName, relRaw, flags) => {
    const from = addNode(fromName, flags);
    if (!from) return;
    parseRelationList(relRaw).forEach(({ target, rel }) => {
      // Сначала ищем уже известного NPC. Таким образом "Майкл" не станет
      // вторым узлом рядом с уже существующим "Michael".
      const existing = resolveExisting(target);
      const to = existing ? existing.id : addNode(target, {});
      if (from && to && from !== to) {
        const duplicate = edges.some(e => e.from === from && e.to === to && e.label === rel);
        if (!duplicate) edges.push({ from, to, label: rel });
      }
    });
  };

  addEdgesFrom(userName, hudRelField(hudData.user), { isUser: true });
  (hudData.characters || []).forEach((c, i) => addEdgesFrom(c && (c['Имя'] || c.N || c.name || c.Name), hudRelField(c), { isPrimary: i === 0 }));
  return { nodes, edges };
}

export function hudHasRelations(hudData) {
  if (!hudData) return false;
  if (parseRelationList(hudRelField(hudData.user)).length) return true;
  return (hudData.characters || []).some(c => parseRelationList(hudRelField(c)).length);
}

function shortenToward(from, to, pad) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: to.x - dx / len * pad, y: to.y - dy / len * pad };
}

function wrapRelationLabel(label, maxCharsPerLine) {
  const raw = String(label || '').trim();
  if (!raw) return [''];
  const limit = Math.max(10, Number(maxCharsPerLine) || 18);
  const words = raw.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= limit) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      current = '';
    }
    if (word.length <= limit) {
      current = word;
    } else {
      let chunk = word;
      while (chunk.length > limit) {
        lines.push(chunk.slice(0, limit));
        chunk = chunk.slice(limit);
      }
      current = chunk;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines.slice(0, 3) : [''];
}

function classifyRelationVisual(label) {
  const s = String(label || '').toLowerCase().replace(/ё/g, 'е');
  const groups = [
    ['love', /люб|влюб|обожа|страст|симпат|привязан|романт|любов|love|adore|romance|crush|attract|fond|cherish|desire/],
    ['friend', /друж|довер|уважа|товариш|союз|прият|дружел|friend|trust|respect|ally|allies|support|close/],
    ['hostile', /ненав|вражд|презир|ярост|злост|ненавист|hate|hatred|enemy|hostile|loathe|disgust|rage|enmity/],
    ['jealous', /ревн|завист|собствен|jealous|envy|possessive/],
    ['fear', /страх|боит|опас|пуга|тревог|fear|afraid|scared|threat|anxious|uneasy/],
    ['suspicious', /подоз|насторож|невер|сомне|suspicious|doubt|distrust|wary|skeptic/],
    ['family', /семь|родн|мать|отец|сын|доч|брат|сестр|муж|жен|family|mother|father|son|daughter|brother|sister|husband|wife/],
    ['neutral', /нейтр|коллег|знаком|делов|рабоч|формаль|нейтрал|neutral|colleague|acquaint|professional|formal/]
  ];
  for (const [type, rx] of groups) if (rx.test(s)) return type;
  return 'other';
}

function relationVisualMeta(type) {
  const meta = {
    love:       { icon: '♥', label: 'Романтика' },
    friend:     { icon: '✦', label: 'Дружба / доверие' },
    hostile:    { icon: '⚔', label: 'Конфликт' },
    jealous:    { icon: '◈', label: 'Ревность' },
    fear:       { icon: '!', label: 'Страх' },
    suspicious: { icon: '?', label: 'Подозрение' },
    family:     { icon: '⌂', label: 'Семья' },
    neutral:    { icon: '•', label: 'Нейтральное' },
    other:      { icon: '·', label: 'Другое' }
  };
  return meta[type] || meta.other;
}

function relNodeRoleClass(node) {
  if (node.isUser) return 'is-user';
  if (node.isPrimary) return 'is-primary';
  return 'is-secondary';
}

export function buildRelGraphHTML(hudData, uid) {
  const { nodes, edges } = collectRelationGraph(hudData || {});
  if (nodes.length < 2 && !edges.length) return '';

  // Responsive virtual canvas: every person gets an equal, deterministic place.
  // User and {{char}} are no longer glued to a single hub position, so the whole
  // cast stays visually separated even when only 3-4 people are present.
  // The outer margin is large enough for the labels and relation badges and the
  // SVG scales down naturally to the available phone/desktop width.
  const W = 1000, H = 760, cx = W / 2, cy = H / 2;
  const n = Math.max(nodes.length, 1);
  const pos = {};
  const orderedNodes = [
    ...nodes.filter(nd => nd.isUser),
    ...nodes.filter(nd => nd.isPrimary && !nd.isUser),
    ...nodes.filter(nd => !nd.isUser && !nd.isPrimary)
  ];

  const nodeRadius = (node) => {
    if (n >= 22) return node.isUser || node.isPrimary ? 26 : 22;
    if (n >= 14) return node.isUser || node.isPrimary ? 30 : 25;
    return node.isUser || node.isPrimary ? 34 : 29;
  };

  const placeRing = (ringNodes, rx, ry, phase) => {
    const count = ringNodes.length;
    if (!count) return;
    ringNodes.forEach((node, i) => {
      const angle = phase + (i * Math.PI * 2 / count);
      pos[node.id] = {
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * ry
      };
    });
  };

  // Small graphs: one perfectly even ellipse. This gives 2 nodes a line of
  // opposition, 3 a triangle, 4 a square, etc. — no privileged center node.
  if (n <= 12) {
    const rx = n <= 3 ? 315 : n <= 6 ? 330 : 345;
    const ry = n <= 3 ? 285 : n <= 6 ? 300 : 320;
    placeRing(orderedNodes, rx, ry, -Math.PI / 2);
  } else {
    // Larger graphs use two balanced concentric ellipses. Both rings are
    // rotated against each other to avoid vertical stacks and label collisions.
    const innerCount = Math.ceil(n / 2);
    placeRing(orderedNodes.slice(0, innerCount), 200, 175, -Math.PI / 2);
    placeRing(orderedNodes.slice(innerCount), 350, 315, -Math.PI / 2 + Math.PI / Math.max(2, n - innerCount));
  }

  const markerBase = `hud-rel-${uid}`.replace(/[^a-zA-Z0-9_-]/g, '');
  const graphId = `hud-rel-graph-${uid}`.replace(/[^a-zA-Z0-9_-]/g, '');
  const escId = value => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '');

  const markerTypes = ['love','friend','hostile','jealous','fear','suspicious','family','neutral','other'];
  let svg = `<div class="hud-rel-graph" data-rel-graph-id="${graphId}" title="Нажмите на персонажа или связь для подробностей">
    <div class="hud-rel-toolbar">
      <div class="hud-rel-heading"><span class="hud-rel-heading-icon">🕸</span><div><strong>Граф отношений</strong><small>${nodes.length} персонажей · ${edges.length} связей</small></div></div>
      <button class="hud-rel-graph-close" type="button" aria-label="Закрыть граф отношений">✕</button>
    </div>
    <div class="hud-rel-stage">
    <svg viewBox="0 0 ${W} ${H}" class="hud-rel-svg" role="img" aria-label="Граф отношений персонажей">
    <defs>
      <filter id="${markerBase}-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <radialGradient id="${markerBase}-core" cx="35%" cy="30%"><stop offset="0%" stop-color="#fff" stop-opacity=".32"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient>
      ${markerTypes.map(type => {
        const markerId = `${markerBase}-arr-${type}`;
        return `<marker id="${markerId}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 1.2 L 10 5 L 0 8.8 Z" class="hud-rel-marker hud-rel-${type}"/></marker>`;
      }).join('')}
    </defs>`;

  // Soft grid / constellation background.
  svg += `<circle class="hud-rel-orbit orbit-1" cx="${cx}" cy="${cy}" r="270" fill="none"/>
          <circle class="hud-rel-orbit orbit-2" cx="${cx}" cy="${cy}" r="180" fill="none"/>
          <circle class="hud-rel-core-glow" cx="${cx}" cy="${cy}" r="74" fill="url(#${markerBase}-core)"/>`;

  const pairCount = {};
  edges.forEach(e => {
    const key = [e.from, e.to].sort().join('|');
    pairCount[key] = (pairCount[key] || 0) + 1;
  });

  edges.forEach(e => {
    const a = pos[e.from], b = pos[e.to];
    if (!a || !b) return;
    const pairKey = [e.from, e.to].sort().join('|');
    const bidirectional = pairCount[pairKey] > 1;
    const dx0 = b.x - a.x, dy0 = b.y - a.y;
    const len0 = Math.hypot(dx0, dy0) || 1;
    const perp = { x: -dy0 / len0, y: dx0 / len0 };
    const sign = e.from < e.to ? 1 : -1;
  
  // 1. Смещаем координаты старта и конца по перпендикуляру для двусторонних связей
  // 1. Убираем sign. Вектор perp сам разнесет встречные линии в разные стороны.
  const offset = bidirectional ? 14 : 0; 
  const aShifted = { x: a.x + perp.x * offset, y: a.y + perp.y * offset };
  const bShifted = { x: b.x + perp.x * offset, y: b.y + perp.y * offset };

  const startPad = nodeRadius(nodes.find(nd => nd.id === e.from) || {}) + 7;
  const endPad = nodeRadius(nodes.find(nd => nd.id === e.to) || {}) + 7;
  
  // 2. Вычисляем точки старта и конца на краях аватарок, используя смещенные координаты
  const start = shortenToward(bShifted, aShifted, startPad);
  const end = shortenToward(aShifted, bShifted, endPad);
  
  // 3. Строим прямую линию (L) и находим ее математическую середину для бейджа
  const d = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
  const lp = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const type = classifyRelationVisual(e.label);
    const meta = relationVisualMeta(type);
    // Directional key: A=>B and B=>A are distinct clickable relations.
    const edgeKey = `${e.from}=>${e.to}`;
    const label = String(e.label || '').trim();
    // Подпись связи переносится на строки (до трёх), а не обрезается многоточием:
    // wrapRelationLabel режет по словам, длинные слова — по символам.
    // В плотном графе (n >= 18) строка короче, чтобы подписи не наезжали друг на друга.
    const labelLines = wrapRelationLabel(label, n >= 18 ? 16 : 22);
    const labelLineH = 11;
    // Блок поднимаем так, чтобы его низ остался там же, где была одиночная строка.
    const labelBaseY = lp.y - 15 - (labelLines.length - 1) * labelLineH;
    const labelTspans = labelLines
      .map((ln, li) => `<tspan x="${lp.x.toFixed(1)}" dy="${li === 0 ? 0 : labelLineH}">${escapeHtml(ln)}</tspan>`)
      .join('');
    const markerId = `${markerBase}-arr-${type}`;
    // Wide invisible hit target sits directly under the visible line. This makes
    // relations easy to tap/click on both desktop and touch screens without
    // making the visual line thicker.
    svg += `<path class="hud-rel-edge-hit" data-rel-type="${type}" data-edge-from="${escapeHtml(e.from)}" data-edge-to="${escapeHtml(e.to)}" data-edge-key="${escapeHtml(edgeKey)}" data-edge-direction="${escapeHtml(e.from)}=>${escapeHtml(e.to)}" data-edge-label="${escapeHtml(label)}" data-rel-bidir="${bidirectional ? 'true' : 'false'}" d="${d}"/>`;
    svg += `<path class="hud-rel-edge hud-rel-${type}" data-rel-type="${type}" data-edge-from="${escapeHtml(e.from)}" data-edge-to="${escapeHtml(e.to)}" data-edge-key="${escapeHtml(edgeKey)}" data-edge-direction="${escapeHtml(e.from)}=>${escapeHtml(e.to)}" data-edge-label="${escapeHtml(label)}" data-rel-bidir="${bidirectional ? 'true' : 'false'}" d="${d}" marker-end="url(#${markerId})"/>`;
    svg += `<g class="hud-rel-edge-badge" data-edge-from="${escapeHtml(e.from)}" data-edge-to="${escapeHtml(e.to)}" data-edge-key="${escapeHtml(edgeKey)}" data-edge-direction="${escapeHtml(e.from)}=>${escapeHtml(e.to)}" data-edge-label="${escapeHtml(label)}" data-rel-type="${type}" data-rel-bidir="${bidirectional ? 'true' : 'false'}"><circle cx="${lp.x.toFixed(1)}" cy="${lp.y.toFixed(1)}" r="10" class="hud-rel-edge-dot hud-rel-${type}"/><text x="${lp.x.toFixed(1)}" y="${(lp.y + 3.3).toFixed(1)}" text-anchor="middle">${meta.icon}</text></g>`;
    svg += `<text class="hud-rel-edge-label" data-edge-from="${escapeHtml(e.from)}" data-edge-to="${escapeHtml(e.to)}" data-edge-key="${escapeHtml(edgeKey)}" data-edge-direction="${escapeHtml(e.from)}=>${escapeHtml(e.to)}" data-edge-label="${escapeHtml(label)}" data-rel-type="${type}" data-rel-bidir="${bidirectional ? 'true' : 'false'}" x="${lp.x.toFixed(1)}" y="${labelBaseY.toFixed(1)}" text-anchor="middle">${labelTspans}</text>`;
  });

  nodes.forEach(node => {
    const p = pos[node.id];
    const r = nodeRadius(node);
    const color = HUD_AVATAR_COLORS[hudHashSeed(node.name) % HUD_AVATAR_COLORS.length];
    const clipId = `${markerBase}-c-${escId(node.id)}`;
    let url = '';
    if (node.isUser) url = getUserAvatarUrl() || '';
    else {
      const av = getAvatarUrl(node.name, node.isPrimary);
      url = (av && av.url) || '';
    }
    const short = node.name.length > 18 ? node.name.slice(0, 17) + '…' : node.name;
    const roleClass = relNodeRoleClass(node);
    const roleText = node.isUser ? 'YOU' : node.isPrimary ? '{{char}}' : 'NPC';
    svg += `<g class="hud-rel-node ${roleClass}" data-node-id="${escapeHtml(node.id)}" data-node-name="${escapeHtml(node.name)}">`;
    svg += `<circle class="hud-rel-node-halo" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r + 7}"/>`;
    svg += `<circle class="hud-rel-node-bg" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="${color}"/>`;
    svg += `<clipPath id="${clipId}"><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r - 2}"/></clipPath>`;
    svg += `<text class="hud-rel-initials" x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" text-anchor="middle" dominant-baseline="central">${escapeHtml(commentInitials(node.name))}</text>`;
    if (url) svg += `<image href="${escapeHtml(url)}" x="${(p.x - r + 2).toFixed(1)}" y="${(p.y - r + 2).toFixed(1)}" width="${(r * 2 - 4).toFixed(1)}" height="${(r * 2 - 4).toFixed(1)}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>`;
    svg += `<circle class="hud-rel-ring" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="none"/>`;
    svg += `<rect class="hud-rel-node-pill" x="${(p.x - 42).toFixed(1)}" y="${(p.y + r + 8).toFixed(1)}" width="84" height="22" rx="11"/>`;
    svg += `<text class="hud-rel-name" x="${p.x.toFixed(1)}" y="${(p.y + r + 22.5).toFixed(1)}" text-anchor="middle">${escapeHtml(short)}</text>`;
    svg += `<text class="hud-rel-role" x="${p.x.toFixed(1)}" y="${(p.y - r - 8).toFixed(1)}" text-anchor="middle">${escapeHtml(roleText)}</text>`;
    svg += `</g>`;
  });
  // Close only the SVG stage here. Keep .hud-rel-graph open so the legend
  // and inspector below belong to the same interactive graph element.
  // This is important when the graph is portaled to <body> in expanded mode:
  // the controls must travel with the graph instead of staying behind in Memory.
  svg += `</svg></div>`;

  const legendTypes = ['love','friend','hostile','jealous','fear','suspicious','family','other'];
  const legend = legendTypes.map(type => {
    const meta = relationVisualMeta(type);
    return `<button type="button" class="hud-rel-legend-item" data-rel-filter="${type}" title="Показать только связи: ${escapeHtml(meta.label)}"><i class="hud-rel-legend-dot hud-rel-${type}"></i><span>${escapeHtml(meta.label)}</span></button>`;
  }).join('');

  return `<div class="hud-row full-width"><div class="hud-rel-shell">${svg}<div class="hud-rel-bottom"><div class="hud-rel-legend">${legend}</div><div class="hud-rel-inspector"><div class="hud-rel-inspector-main">Выбери персонажа или связь</div><div class="hud-rel-inspector-sub">Клик по узлу подсветит его окружение</div></div></div></div></div></div>`;
}

function updateRelGraphInspector(graphEl) {
  if (!graphEl) return;
  const main = graphEl.querySelector('.hud-rel-inspector-main');
  const sub = graphEl.querySelector('.hud-rel-inspector-sub');
  if (!main || !sub) return;

  const focusNode = graphEl.dataset.focusNode || '';
  const focusEdge = graphEl.dataset.focusEdge || '';
  const focusType = graphEl.dataset.focusType || '';

  if (focusEdge) {
    const edge = graphEl.querySelector(`.hud-rel-edge[data-edge-key=\"${CSS.escape(focusEdge)}\"]`);
    const label = graphEl.querySelector(`.hud-rel-edge-label[data-edge-key=\"${CSS.escape(focusEdge)}\"]`);
    const from = edge?.dataset.edgeFrom || 'Персонаж';
    const to = edge?.dataset.edgeTo || 'Персонаж';
    const relationText = edge?.dataset.edgeLabel || label?.textContent.trim() || 'Выбранная связь';
    main.textContent = `${from} → ${to}`;
    sub.textContent = relationText || 'Выбранная связь';
    return;
  }

  if (focusNode) {
    const node = graphEl.querySelector(`.hud-rel-node[data-node-id=\"${CSS.escape(focusNode)}\"]`);
    const name = node?.dataset.nodeName || focusNode;
    const count = Array.from(graphEl.querySelectorAll('.hud-rel-edge')).filter(edge =>
      edge.dataset.edgeFrom === focusNode || edge.dataset.edgeTo === focusNode
    ).length;
    main.textContent = name;
    sub.textContent = count ? `${count} связ${count === 1 ? 'ь' : 'и'} с персонажем` : 'Связей пока нет';
    return;
  }

  if (focusType) {
    const meta = relationVisualMeta(focusType);
    const count = graphEl.querySelectorAll(`.hud-rel-edge[data-rel-type=\"${CSS.escape(focusType)}\"]`).length;
    main.textContent = meta.label;
    sub.textContent = `${count} связ${count === 1 ? 'ь' : 'и'} этого типа`;
    return;
  }

  main.textContent = 'Выбери персонажа или связь';
  sub.textContent = 'Клик по узлу подсветит его окружение';
}

export function applyRelGraphFocus(graphEl, focusNodeId, focusEdgeKey, focusType) {
  if (!graphEl) return;
  const nodes = graphEl.querySelectorAll('.hud-rel-node');
  const edges = graphEl.querySelectorAll('.hud-rel-edge, .hud-rel-edge-hit, .hud-rel-edge-badge');
  const labels = graphEl.querySelectorAll('.hud-rel-edge-label');
  const legendItems = graphEl.querySelectorAll('.hud-rel-legend-item');
  const activeNodeId = focusNodeId || '';
  const activeEdge = focusEdgeKey || '';
  const activeType = focusType || '';
  const activeEdgeEl = activeEdge
    ? graphEl.querySelector(`.hud-rel-edge[data-edge-key=\"${CSS.escape(activeEdge)}\"]`)
    : null;
  const edgeNodes = activeEdgeEl
    ? [activeEdgeEl.dataset.edgeFrom || '', activeEdgeEl.dataset.edgeTo || '']
    : [];
  const hasFocus = Boolean(activeNodeId || activeEdge || activeType);
  graphEl.classList.toggle('is-focused', hasFocus);
  graphEl.dataset.focusNode = activeNodeId;
  graphEl.dataset.focusEdge = activeEdge;
  graphEl.dataset.focusType = activeType;

  nodes.forEach(node => {
    const id = node.dataset.nodeId || '';
    const isFocusedNode = Boolean(activeNodeId) && id === activeNodeId;
    // When a line is selected BOTH endpoints are highlighted as first-class targets.
    const isEdgeEndpoint = Boolean(activeEdge) && edgeNodes.includes(id);
    const isTypeRelated = Boolean(activeType) && Array.from(edges).some(e => e.dataset.relType === activeType && (e.dataset.edgeFrom === id || e.dataset.edgeTo === id));
    const isActive = isFocusedNode || isEdgeEndpoint || isTypeRelated;
    const shouldDim = hasFocus && !isActive;
    node.classList.toggle('is-focused', isFocusedNode || isEdgeEndpoint);
    node.classList.toggle('is-edge-endpoint', isEdgeEndpoint);
    node.classList.toggle('is-active-line', isEdgeEndpoint || isTypeRelated);
    node.classList.toggle('is-dimmed', shouldDim);

    if (isEdgeEndpoint) {
      const [from] = edgeNodes;
      const dx = id === from ? 14 : -14;
      const dy = id === from ? -10 : 10;
      node.setAttribute('transform', `translate(${dx} ${dy})`);
    } else {
      node.setAttribute('transform', 'translate(0 0)');
    }
  });

  edges.forEach(edge => {
    const from = edge.dataset.edgeFrom || '';
    const to = edge.dataset.edgeTo || '';
    const key = `${from}=>${to}`;
    const type = edge.dataset.relType || '';
    const isActiveByNode = Boolean(activeNodeId) && (from === activeNodeId || to === activeNodeId);
    const isActiveByEdge = Boolean(activeEdge) && key === activeEdge;
    const isActiveByType = Boolean(activeType) && type === activeType;
    const isActive = isActiveByNode || isActiveByEdge || isActiveByType;
    // is-flowing — только у стрелки, по которой ткнули напрямую. Клик по узлу
    // или фильтр легенды подсвечивают связи, но бегущий пунктир не запускают.
    // focusEdgeKey всегда один, поэтому одновременно течёт ровно одна стрелка.
    edge.classList.toggle('is-flowing', isActiveByEdge);
    edge.classList.toggle('is-active', isActive);
    edge.classList.toggle('is-dimmed', hasFocus && !isActive);
    edge.classList.toggle('is-pulsing', isActive);
  });

  labels.forEach(label => {
    const from = label.dataset.edgeFrom || '';
    const to = label.dataset.edgeTo || '';
    const key = `${from}=>${to}`;
    const type = label.dataset.relType || '';
    const isActiveByNode = Boolean(activeNodeId) && (from === activeNodeId || to === activeNodeId);
    const isActiveByEdge = Boolean(activeEdge) && key === activeEdge;
    const isActiveByType = Boolean(activeType) && type === activeType;
    const isActive = isActiveByNode || isActiveByEdge || isActiveByType;
    label.classList.toggle('is-active', isActive);
    label.classList.toggle('is-dimmed', hasFocus && !isActive);
  });

  legendItems.forEach(item => item.classList.toggle('is-selected', item.dataset.relFilter === activeType));
  updateRelGraphInspector(graphEl);
}

// Раскрытый граф центрируется ИЗМЕРЕНИЕМ, а не процентами и не vw/vh.
//
// На мобильном SillyTavern вешает на <html> position:fixed и трансформ.
// Любой трансформ делает элемент содержащим блоком для position:fixed
// потомков, и left/top отсчитываются уже не от вьюпорта, а от границы
// этого блока — граф уезжал в верхний левый угол. vw/vh спасали только
// от нулевой ширины контейнера, но не от его смещения.
//
// Порядок: ставим элемент в начало координат контейнера, смотрим, где он
// оказался на экране, и сдвигаем на разницу до центра вьюпорта. Заодно
// вычисляем масштаб предка (нарисованная ширина / вёрстанная), иначе под
// scale() пиксельный сдвиг был бы неверным.
function centerExpandedRelGraph(graphEl) {
  if (!graphEl || !graphEl.classList.contains('is-expanded')) return;
  const zoom = graphEl.dataset.zoom || '1';
  const set = (prop, value) => graphEl.style.setProperty(prop, value, 'important');

  set('transform', 'none');
  set('left', '0px');
  set('top', '0px');

  const probe = graphEl.getBoundingClientRect();
  const laidOutWidth = graphEl.offsetWidth || probe.width || 1;
  const scale = probe.width ? (probe.width / laidOutWidth) : 1;
  const s = (Number.isFinite(scale) && scale > 0.01) ? scale : 1;

  const viewW = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewH = window.innerHeight || document.documentElement.clientHeight || 0;

  set('left', ((viewW / 2 - probe.left) / s) + 'px');
  set('top', ((viewH / 2 - probe.top) / s) + 'px');
  set('transform', 'translate(-50%, -50%) scale(' + zoom + ')');

  const backdrop = document.querySelector('.hud-rel-graph-backdrop');
  if (backdrop) {
    const bset = (prop, value) => backdrop.style.setProperty(prop, value, 'important');
    bset('left', '0px'); bset('top', '0px');
    const bProbe = backdrop.getBoundingClientRect();
    const bLaidOut = backdrop.offsetWidth || bProbe.width || 1;
    const bScale = bProbe.width ? (bProbe.width / bLaidOut) : 1;
    const bs = (Number.isFinite(bScale) && bScale > 0.01) ? bScale : 1;
    bset('left', (-bProbe.left / bs) + 'px');
    bset('top', (-bProbe.top / bs) + 'px');
    bset('width', (viewW / bs) + 'px');
    bset('height', (viewH / bs) + 'px');
    bset('right', 'auto'); bset('bottom', 'auto');
  }
}

// Пересчёт при повороте экрана и появлении экранной клавиатуры.
let relGraphViewportHookBound = false;
function bindRelGraphViewportHook() {
  if (relGraphViewportHookBound || typeof window === 'undefined') return;
  relGraphViewportHookBound = true;
  const recenter = () => {
    const open = document.querySelector('.hud-rel-graph.is-expanded');
    if (open) centerExpandedRelGraph(open);
  };
  window.addEventListener('resize', recenter);
  window.addEventListener('orientationchange', recenter);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', recenter);
}

export function setRelGraphExpandedState(graphEl, expanded) {
  if (!graphEl) return;

  let backdrop = document.querySelector('.hud-rel-graph-backdrop');

  if (expanded) {
    graphEl.classList.add('is-expanded');

    graphEl.dataset.zoom = graphEl.dataset.zoom || '1';
    graphEl.style.setProperty('--hud-rel-zoom', graphEl.dataset.zoom);

    // Запоминаем исходное место графа, чтобы после закрытия вернуть его туда же.
    if (!graphEl._hudRelHome) {
      const placeholder = document.createElement('span');
      placeholder.className = 'hud-rel-graph-placeholder';
      placeholder.style.cssText = 'display:block;width:0;height:0;';

      graphEl.parentNode.insertBefore(placeholder, graphEl);

      graphEl._hudRelHome = {
        parent: placeholder.parentNode,
        placeholder
      };
    }

    // Backdrop живёт непосредственно в body.
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'hud-rel-graph-backdrop';
      document.body.appendChild(backdrop);
    }

    // Главный фикс: вынимаем раскрытый граф из .hud-body/.hud-memory-panel
    // и помещаем его непосредственно в body, чтобы overflow/contain родителей
    // больше не могли ограничивать fixed-позиционирование.
    if (graphEl.parentNode !== document.body) {
      document.body.appendChild(graphEl);
    }

    backdrop.classList.add('visible');

    // Считаем позицию после того, как элемент уже в body и получил размеры.
    bindRelGraphViewportHook();
    centerExpandedRelGraph(graphEl);
    requestAnimationFrame(() => centerExpandedRelGraph(graphEl));
  } else {
    // Возвращаем граф в исходную позицию.
    const home = graphEl._hudRelHome;
    if (home?.placeholder?.parentNode) {
      home.placeholder.parentNode.insertBefore(graphEl, home.placeholder.nextSibling);
      home.placeholder.remove();
    }
    delete graphEl._hudRelHome;

    graphEl.classList.remove('is-expanded');
    // Снимаем измеренные координаты, иначе они останутся на свёрнутом графе.
    ['left', 'top', 'transform'].forEach(p => graphEl.style.removeProperty(p));
    graphEl.style.setProperty('--hud-rel-zoom', '1');
    graphEl.dataset.zoom = '1';
    graphEl.dataset.tx = '0';
    graphEl.dataset.ty = '0';
    const svgEl = graphEl.querySelector('.hud-rel-svg');
    if (svgEl) {
        svgEl.style.transform = '';
        svgEl.style.transformOrigin = '';
    }

    if (backdrop) {
      backdrop.classList.remove('visible');
      setTimeout(() => {
        if (backdrop && !backdrop.classList.contains('visible')) backdrop.remove();
      }, 220);
    }
  }
}
