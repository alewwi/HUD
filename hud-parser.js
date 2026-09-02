// hud-manager/hud-parser.js
//
// Извлечение и ремонт HUD-JSON из ответа модели.
//
// Модели регулярно присылают почти-JSON: одинарные кавычки, висячие запятые,
// незакрытые строки, обрезанный хвост, HTML-подсветку от markdown-рендерера.
// Здесь это по очереди чинится, кандидаты оцениваются и лучший отдаётся в
// нормализацию схемы.

import { normalizeJSONData } from './schema.js?v=22.7.4';

export function parseLegacyHUD(content) { return { scene: {}, characters: [], user: {}, memory: { timeline: [], mood: { user: { current: '', history: [] }, char: { current: '', history: [] } }, route: { user: [], char: [] }, important: [], secrets: [] }, intercepts: [], dreams: [], diary: [], world: { headlines: [], rumors: [], ads: [], comments: [] } }; }

export function decodeHighlightedHudHtml(input) {
  if (typeof input !== 'string') return '';
  let text = input;

  // Some ST render paths escape the highlighted HTML transport itself, so
  // markup can arrive as \<q>...\</q> and line breaks as a literal\n.
  // Those backslashes are transport artifacts, not JSON content. Remove
  // them before asking the browser to decode the highlight markup.
  // ST can escape the already-rendered HTML one or more times.  In the
  // actual message this may therefore look like \\<q> or \\\\<q>, and a
  // literal backslash can also precede every highlighted line break.
  // Strip only backslashes that are clearly transport escapes for markup
  // or line breaks; NEVER unescape arbitrary JSON string content.
  text = text
    .replace(/\\+(?=\s*<\/?[a-z!/])/gi, '')
    .replace(/\\+(?=\r?\n)/g, '')
    .replace(/\\+(?=\s*<)/g, '');

  // A few ST/highlighter paths escape the angle brackets as text after the
  // first pass.  Run the same narrowly-scoped transport cleanup again so
  // that \\<q> becomes <q> before DOM parsing.
  text = text.replace(/\\+(?=<)/g, '');

  // SillyTavern renders fenced JSON with highlight.js. In that state the HUD
  // is no longer plain JSON: keys become e.g. <span class="hljs-string">"scene"</span>.
  // Use a DOM text extraction pass so the markup is removed while the actual
  // JSON characters and HTML entities are preserved/decoded.
  if (/[<][a-z!/][^>]*>/i.test(text)) {
    try {
      const holder = document.createElement('div');
      holder.innerHTML = text;
      text = holder.textContent || holder.innerText || '';
    } catch (e) {
      text = text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
    }
  }

  // If the browser received escaped markup as text, strip the remaining
  // highlighting tags after transport unescaping as a final safe pass.
  if (/[<]\/?(?:q|span|code|pre|div|br)(?:\s|>)/i.test(text)) {
    text = text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
  }

  // Decode entities even when there was no actual HTML element.
  try {
    const holder = document.createElement('textarea');
    holder.innerHTML = text;
    text = holder.value;
  } catch (e) {}

  return text
    .replace(/\u00A0|\u200B|\u202F|\uFEFF/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/```(?:json|JSON)?/gi, '')
    .replace(/```/g, '')
    .trim();
}

export function extractBalancedJsonCandidates(text) {
  const candidates = [];
  if (typeof text !== 'string' || !text) return candidates;

  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') { inString = true; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          candidates.push(text.slice(i, j + 1));
          i = j;
          break;
        }
      }
    }
  }
  return candidates;
}

// ---------------------------------------------------------------------------
// HUD DIAGNOSTICS / SAFE JSON REPAIR
// ---------------------------------------------------------------------------
export function setHudRepairDiagnostic(patch = {}) {
  const previous = window.__tavernOSHudRepairDiagnostic || {};
  window.__tavernOSHudRepairDiagnostic = {
    repaired: false,
    mode: 'none',
    timestamp: Date.now(),
    ...previous,
    ...patch,
    timestamp: Date.now(),
  };
  return window.__tavernOSHudRepairDiagnostic;
}

// Converts the two common non-JSON dialects only as a LAST resort:
//   {foo: 'bar'} -> {"foo": "bar"}
// It is scanner-based so apostrophes inside normal JSON strings are not touched.
export function repairCommonJsonDialect(jsonStr) {
  let source = String(jsonStr || '').trim();
  if (!source) return source;

  // First quote unquoted object keys outside strings.
  let out = '';
  let inDouble = false;
  let inSingle = false;
  let escaped = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inDouble) {
      out += ch;
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') escaped = true;
      else if (ch === '"') inDouble = false;
      continue;
    }
    if (inSingle) {
      out += ch;
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') escaped = true;
      else if (ch === "'") inSingle = false;
      continue;
    }
    if (ch === '"') { inDouble = true; out += ch; continue; }
    if (ch === "'") { inSingle = true; out += ch; continue; }
    if (ch === '{' || ch === ',') {
      let j = i + 1;
      while (/\s/.test(source[j] || '')) j++;
      const keyMatch = source.slice(j).match(/^([A-Za-z_$][A-Za-z0-9_$-]*)\s*:/);
      if (keyMatch) {
        out += ch + source.slice(i + 1, j) + '"' + keyMatch[1] + '"';
        i = j + keyMatch[0].length - 1;
        out += ':';
        continue;
      }
    }
    out += ch;
  }

  // Convert single-quoted strings to JSON strings. This is deliberately a
  // separate pass and only runs if a single quote remains outside a double string.
  source = out;
  out = '';
  inDouble = false;
  inSingle = false;
  escaped = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inDouble) {
      out += ch;
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') escaped = true;
      else if (ch === '"') inDouble = false;
      continue;
    }
    if (inSingle) {
      if (escaped) {
        // JSON understands \", \\, \\n etc. A JS-style escaped single quote
        // is simply an apostrophe in JSON, so drop only that escape slash.
        if (ch === "'") out += "'";
        else if (ch === '\\') out += '\\\\';
        else out += '\\' + ch;
        escaped = false;
        continue;
      }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === "'") { out += '"'; inSingle = false; continue; }
      if (ch === '"') out += '\\"';
      else out += ch;
      continue;
    }
    if (ch === '"') { inDouble = true; out += ch; continue; }
    if (ch === "'") { inSingle = true; out += '"'; continue; }
    out += ch;
  }
  if (inSingle) out += '"';
  return out;
}

// JSON permits escaped control characters inside strings, but models sometimes
// emit literal newlines/tabs (e.g. a long field split across lines). Normalize
// only control characters that occur INSIDE a JSON string; never alter normal
// whitespace between tokens or content outside strings.
export function repairHudJsonControlChars(jsonStr) {
  const source = String(jsonStr || '');
  let out = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const code = ch.charCodeAt(0);

    if (!inString) {
      out += ch;
      if (ch === '"') inString = true;
      continue;
    }

    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      out += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      out += ch;
      inString = false;
      continue;
    }

    if (code === 0x0A) { out += '\\n'; continue; }
    if (code === 0x0D) {
      if (source[i + 1] === '\n') i++;
      out += '\\n';
      continue;
    }
    if (code === 0x09) { out += '\\t'; continue; }
    if (code === 0x08) { out += '\\b'; continue; }
    if (code === 0x0C) { out += '\\f'; continue; }
    if (code < 0x20) {
      out += '\\u' + code.toString(16).padStart(4, '0');
      continue;
    }

    out += ch;
  }
  return out;
}

export function repairHudJsonStructural(jsonStr) {
  const source = String(jsonStr || '');
  const variants = [];
  const seen = new Set();

  const add = (text, mode) => {
    if (!text || seen.has(text)) return;
    seen.add(text);
    variants.push({ text, mode });
  };

  // Repair a very common model failure: a property/array item was emitted
  // without the comma that separates it from the next token. We use the
  // JSON parser's exact error position and only insert punctuation when the
  // surrounding tokens make the repair structurally unambiguous.
  const parseError = (() => {
    try { JSON.parse(source); return null; }
    catch (e) { return e; }
  })();

  if (parseError) {
    const pos = Number.isInteger(parseError.position) ? parseError.position : (() => { const m = String(parseError.message || '').match(/position\s+(\d+)/i); return m ? Number(m[1]) : -1; })();
    if (pos < 0) return variants;
    const before = source.slice(0, pos);
    const after = source.slice(pos);
    const next = after.match(/^\s*(?:(\")|([\[\{]))/);
    const nextChar = next ? (next[1] || next[2]) : '';

    // Object property:  "a": 1  "b": 2  ->  "a": 1, "b": 2
    if (/Expected ',' or '}' after property value|Expected ',' or '}'/.test(parseError.message || '') && nextChar === '"') {
      add(before.replace(/\s*$/, '') + ',' + after, 'structural-comma');
    }

    // Array item:  ["a" "b"]  or  [{...} {...}]  -> insert comma.
    if (/Expected ',' or ']'/i.test(parseError.message || '') && nextChar) {
      add(before.replace(/\s*$/, '') + ',' + after, 'structural-comma');
    }
  }

  // A few providers report a generic "Unexpected token" instead of the
  // more useful comma-specific message. Try the same repair at the first
  // likely next property boundary, but never inside a quoted string.
  let inString = false;
  let escaped = false;
  let depth = 0;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth = Math.max(0, depth - 1);

    if (depth > 0 && ch === ':' && /\s*"[^"\\]*(?:\\.[^"\\]*)*"\s*:/.test(source.slice(i + 1))) {
      const tail = source.slice(i + 1);
      const m = tail.match(/^(\s*)"/);
      if (m && i > 0) {
        const prev = source.slice(0, i + 1);
        const after = source.slice(i + 1);
        // Only use this fallback if the value before the next quote looks
        // complete (string/number/true/false/null/object/array).
        if (/(?:"|\d|true|false|null|[}\]])\s*$/.test(prev)) {
          add(prev.replace(/\s*$/, '') + ',' + after, 'structural-comma-scan');
        }
      }
    }
  }

  return variants;
}

  // Repairs JSON that ends while a JSON string is still open.
// Uses a small JSON-aware scanner so escaped quotes (\\") do not get mistaken
// for the end of the string. It only appends a quote; structural closure is
// delegated to the existing truncated-JSON repair.
export function repairHudJsonUnterminatedString(input) {
  const source = String(input || '');
  if (!source) return null;

  let inString = false;
  let escaped = false;
  let stringStart = -1;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];

    if (!inString) {
      if (ch === '"') {
        inString = true;
        escaped = false;
        stringStart = i;
      }
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = false;
      stringStart = -1;
    }
  }

  if (!inString || stringStart < 0) return null;

  // If the string is open at EOF, closing only that string is the safest
  // first step. The existing truncated repair can then close containers.
  return source + '"';
}

export function scoreHudJsonCandidate(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return -Infinity;

  const has = (...keys) => keys.some(key => Object.prototype.hasOwnProperty.call(parsed, key));
  let score = 0;

  // A model response can contain several valid JSON objects. Only one of
  // them is the HUD payload; prefer the object whose top-level shape matches
  // the HUD schema instead of blindly taking the first parseable object.
  if (has('scene', 'сцена', 'Scene')) score += 12;
  if (has('characters', 'character', 'персонажи', 'Characters')) score += 12;
  if (has('user', 'пользователь', 'User')) score += 7;
  if (has('intercepts', 'перехваты')) score += 3;
  if (has('diary', 'дневник')) score += 3;
  if (has('dreams', 'dream', 'сны', 'сновидения')) score += 3;
  if (has('world', 'мир')) score += 3;

  const scene = parsed.scene ?? parsed['сцена'] ?? parsed.Scene;
  const chars = parsed.characters ?? parsed.character ?? parsed['персонажи'] ?? parsed.Characters;
  if (scene && typeof scene === 'object' && !Array.isArray(scene)) score += 4;
  if (Array.isArray(chars)) score += 4;
  else if (chars && typeof chars === 'object') score += 2;

  return score;
}

export function tryParseHudJsonCandidate(candidate) {
  const raw = String(candidate || '');
  const controlSafe = repairHudJsonControlChars(raw);
  const stateful = repairHudJsonUnterminatedString(controlSafe);
  const structural = repairHudJsonStructural(controlSafe);

  const attempts = [
    { text: raw, mode: 'direct' },
    { text: controlSafe, mode: 'control-chars' },

    // New state-aware path: close only an actually open JSON string first,
    // then let the existing truncation repair close arrays/objects.
    ...(stateful ? [
      { text: stateful, mode: 'unterminated-string' },
      { text: repairTruncatedHudJson(stateful), mode: 'unterminated-string+truncated' },
      { text: repairHudJsonSyntax(stateful), mode: 'unterminated-string+syntax' },
      { text: repairCommonJsonDialect(stateful), mode: 'unterminated-string+dialect' },
      { text: repairCommonJsonDialect(repairTruncatedHudJson(stateful)), mode: 'unterminated-string+truncated+dialect' },
    ] : []),

    ...structural.map(item => ({ text: item.text, mode: `control-chars+${item.mode}` })),
    { text: repairHudJsonSyntax(raw), mode: 'syntax' },
    { text: repairHudJsonSyntax(controlSafe), mode: 'control-chars+syntax' },
    { text: repairTruncatedHudJson(raw), mode: 'truncated' },
    { text: repairCommonJsonDialect(raw), mode: 'dialect' },
    { text: repairCommonJsonDialect(repairTruncatedHudJson(raw)), mode: 'truncated+dialect' },
    { text: repairCommonJsonDialect(controlSafe), mode: 'control-chars+dialect' },
  ];

  let lastError = null;
  for (const attempt of attempts) {
    if (typeof attempt.text !== 'string' || !attempt.text.trim()) continue;
    try {
      const parsed = JSON.parse(attempt.text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      return { parsed, mode: attempt.mode, text: attempt.text };
    } catch (e) {
      lastError = e;
    }
  }
  return { parsed: null, mode: null, text: null, error: lastError };
}


export function repairHudJsonSyntax(jsonStr) {
  let repaired = String(jsonStr || '');
  repaired = repaired.replace(/^\uFEFF/, '').trim();
  // Remove JS-style comments only when they are on their own line; do not
  // touch comment-like content inside JSON strings.
  repaired = repaired.replace(/(^|\n)\s*\/\/[^\n]*/g, '$1');
  repaired = repaired.replace(/,\s*([}\]])/g, '$1');
  return repaired;
}


export function repairTruncatedHudJson(jsonStr) {
  let s = repairHudJsonSyntax(jsonStr).trim();
  if (!s) return s;
  // Remove a terminal backslash that escapes a character which never arrived.
  let inString = false, escaped = false, stack = [];
  let lastSafe = s.length;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') {
      const want = ch === '}' ? '{' : '[';
      if (stack[stack.length - 1] === want) stack.pop();
    }
  }
  if (inString) {
    if (escaped) s = s.slice(0, -1);
    s += '"';
  }
  // A truncated property ending in ':' has no value. Remove that incomplete property.
  s = s.replace(/,?\s*"(?:[^"\\]|\\.)*"\s*:\s*$/s, '');
  s = s.replace(/:\s*$/s, '');
  // A trailing comma is safe to remove before closing containers.
  s = s.replace(/,\s*$/s, '');
  // Re-scan after the string/property cleanup and close only genuinely open containers.
  stack = []; inString = false; escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') inString = false;
    } else {
      if (ch === '"') inString = true;
      else if (ch === '{' || ch === '[') stack.push(ch);
      else if (ch === '}' || ch === ']') {
        const want = ch === '}' ? '{' : '[';
        if (stack[stack.length - 1] === want) stack.pop();
      }
    }
  }
  while (stack.length) s += stack.pop() === '{' ? '}' : ']';
  return s;
}

export function repairGeneratedHudBlock(aiText) {
  const source = String(aiText || '');
  const match = source.match(/(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)([\s\S]*?)(?:(?:\[|&lt;|<|&#91;)\s*(?:\/|&#47;|\\)\s*HUD\s*(?:\]|&gt;|>|&#93;)|$)/i);
  if (!match) {
    setHudRepairDiagnostic({ repaired: false, mode: 'missing-hud' });
    throw new Error('Не удалось найти HUD в ответе ИИ. Попробуйте еще раз.');
  }
  const rawInner = match[1] || '';
  try {
    const parsed = parseHUDComplex(rawInner);
    const diag = window.__tavernOSHudRepairDiagnostic || {};
    // Preserve already-valid output byte-for-byte; canonicalize only when a repair was needed.
    if (diag.repaired) {
      return `[HUD]\n\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\`\n[/HUD]`;
    }
    return `[HUD]\n\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\`\n[/HUD]`;
  } catch (initialError) {
    const decoded = decodeHighlightedHudHtml(rawInner);
    const candidates = extractBalancedJsonCandidates(decoded);
    if (!candidates.length) {
      const firstBrace = decoded.indexOf('{');
      if (firstBrace >= 0) candidates.push(decoded.slice(firstBrace));
    }
    let lastError = initialError;
    const parsedCandidates = [];
    for (let index = 0; index < candidates.length; index++) {
      const result = tryParseHudJsonCandidate(candidates[index]);
      if (result.parsed) {
        parsedCandidates.push({ index, parsed: result.parsed, mode: result.mode || 'direct', score: scoreHudJsonCandidate(result.parsed) });
      }
      if (result.error) lastError = result.error;
    }
    if (parsedCandidates.length) {
      parsedCandidates.sort((a, b) => b.score - a.score || a.index - b.index);
      const selected = parsedCandidates[0];
      const repaired = selected.mode !== 'direct';
      setHudRepairDiagnostic({
        repaired,
        mode: selected.mode,
        error: null,
        candidateCount: candidates.length,
        parsedCandidateCount: parsedCandidates.length,
        selectedCandidate: selected.index,
        selectedScore: selected.score,
      });
      console.debug('[TavernOS HUD] HUD JSON repair result', window.__tavernOSHudRepairDiagnostic);
      return `[HUD]\n\`\`\`json\n${JSON.stringify(selected.parsed, null, 2)}\n\`\`\`\n[/HUD]`;
    }
    setHudRepairDiagnostic({ repaired: false, mode: 'failed', error: lastError?.message || 'invalid JSON', errorPosition: lastError?.message?.match(/position (\d+)/)?.[1] ? Number(lastError.message.match(/position (\d+)/)[1]) : null });
    throw new Error('HUD JSON repair failed: ' + (lastError?.message || 'invalid JSON'));
  }
}

export function parseHUDComplex(contentEncoded) {
  const decoded = decodeHighlightedHudHtml(contentEncoded);
  const candidates = extractBalancedJsonCandidates(decoded);
  if (!candidates.length) {
    const firstBrace = decoded.indexOf('{');
    if (firstBrace >= 0) candidates.push(decoded.slice(firstBrace));
  }
  if (!candidates.length) {
    setHudRepairDiagnostic({ repaired: false, mode: 'no-candidate' });
    throw new Error('HUD JSON parse failed: no JSON object found');
  }

  let lastError = null;
  const parsedCandidates = [];

  // IMPORTANT: a response may contain multiple valid JSON objects. Parse all
  // of them and select the HUD-shaped one. This prevents an auxiliary object
  // (chat state / diary / world / debug JSON) from being rendered as HUD just
  // because it happened to appear first.
  for (let index = 0; index < candidates.length; index++) {
    const result = tryParseHudJsonCandidate(candidates[index]);
    if (result.parsed) {
      parsedCandidates.push({
        index,
        parsed: result.parsed,
        mode: result.mode || 'direct',
        score: scoreHudJsonCandidate(result.parsed),
      });
    }
    if (result.error) lastError = result.error;
  }

  if (parsedCandidates.length) {
    parsedCandidates.sort((a, b) => b.score - a.score || a.index - b.index);
    const selected = parsedCandidates[0];
    const repaired = selected.mode !== 'direct';
    setHudRepairDiagnostic({
      repaired,
      mode: selected.mode,
      error: null,
      candidateCount: candidates.length,
      parsedCandidateCount: parsedCandidates.length,
      selectedCandidate: selected.index,
      selectedScore: selected.score,
    });

    if (parsedCandidates.length > 1) {
      console.debug('[TavernOS HUD] Multiple JSON candidates detected; selected HUD-shaped candidate', {
        candidates: candidates.length,
        parsed: parsedCandidates.length,
        selectedCandidate: selected.index,
        selectedScore: selected.score,
        scores: parsedCandidates.map(item => ({ index: item.index, score: item.score, mode: item.mode })),
      });
    }
    if (repaired) console.debug('[TavernOS HUD] HUD JSON repaired', window.__tavernOSHudRepairDiagnostic);
    return normalizeJSONData(selected.parsed);
  }

  const preview = decoded.slice(0, 500).replace(/\n/g, '\\n');
  setHudRepairDiagnostic({ repaired: false, mode: 'failed', error: lastError?.message || 'invalid JSON', candidateCount: candidates.length });
  console.error('[TavernOS HUD] All HUD JSON candidates failed', {
    candidates: candidates.length,
    preview,
    error: lastError && lastError.message,
    repaired: false,
  });
  throw new Error('HUD JSON parse failed: ' + (lastError ? lastError.message : 'invalid JSON'));
}
