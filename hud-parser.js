// hud-manager/hud-parser.js
//
// Извлечение и ремонт HUD-JSON из ответа модели.
//
// Модели регулярно присылают почти-JSON: одинарные кавычки, висячие запятые,
// незакрытые строки, обрезанный хвост, HTML-подсветку от markdown-рендерера.
// Здесь это по очереди чинится, кандидаты оцениваются и лучший отдаётся в
// нормализацию схемы.

import { normalizeJSONData } from './schema.js?v=22.99.79';
import { hudBlockRe } from './hud-block.js?v=22.99.79';

function decodeHighlightedHudHtml(input) {
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
      // DOMParser, а не innerHTML отстёгнутого div: там <img onerror> из
      // ответа модели срабатывал бы прямо при разборе. В документе DOMParser
      // скрипты и загрузки не выполняются.
      const doc = new DOMParser().parseFromString('<!doctype html><body>' + text, 'text/html');
      text = (doc.body && doc.body.textContent) || '';
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

function extractBalancedJsonCandidates(text) {
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
// SAFE JSON REPAIR
// ---------------------------------------------------------------------------
// Converts the two common non-JSON dialects only as a LAST resort:
//   {foo: 'bar'} -> {"foo": "bar"}
// It is scanner-based so apostrophes inside normal JSON strings are not touched.
function repairCommonJsonDialect(jsonStr) {
  const source = String(jsonStr || '').trim();
  if (!source) return source;

  // Один проход: ключи без кавычек получают кавычки, строки в одинарных
  // кавычках становятся JSON-строками. Раньше это были два прохода по всей
  // строке, и поиск ключа после каждой «{» и «,» копировал весь хвост.
  const КЛЮЧ = /\s*([A-Za-z_$][A-Za-z0-9_$-]*)\s*:/y;
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
    if (ch === '{' || ch === ',') {
      КЛЮЧ.lastIndex = i + 1;
      const m = КЛЮЧ.exec(source);
      if (m) {
        out += ch + source.slice(i + 1, i + 1 + m[0].indexOf(m[1])) + '"' + m[1] + '":';
        i += m[0].length;
        continue;
      }
    }
    out += ch;
  }
  if (inSingle) out += '"';
  return out;
}

// JSON permits escaped control characters inside strings, but models sometimes
// emit literal newlines/tabs (e.g. a long field split across lines). Normalize
// only control characters that occur INSIDE a JSON string; never alter normal
// whitespace between tokens or content outside strings.
function repairHudJsonControlChars(jsonStr) {
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

function repairHudJsonStructural(jsonStr) {
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
function repairHudJsonUnterminatedString(input) {
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

// Неэкранированные кавычки внутри строки: «он сказал "нет" и ушёл». JSON
// закрывал строку на первой же такой кавычке, разбор ломался, а починка
// обрезала текст — цитата в дневнике обрывалась на полуслове. Кавычка
// закрывает строку, только если за ней идёт то, что в JSON может стоять
// после строки: запятая перед следующим значением, скобка, двоеточие ключа.
function repairHudJsonInnerQuotes(jsonStr) {
  const s = String(jsonStr || '');
  // Кавычка закрывает строку, только если после неё по правилам JSON строка
  // действительно может кончиться. Раньше закрытием считались и кавычка перед
  // двоеточием, скобкой или другой кавычкой — и цитата в самом конце фразы
  // («сказал "стоп"»), перед двоеточием или скобкой ломала разбор. Запасная
  // починка потом обрезала текст: первая кавычка оставалась, второй не было.
  // Теперь учитываем, ключ это или значение и в объекте мы или в массиве.
  let out = '', inString = false, escaped = false, ключ = false;
  const стек = [];
  let последний = '';
  const значимый = (j) => { while (j < s.length && /\s/.test(s[j])) j++; return j; };
  const можноЗакрыть = (i) => {
    const j = значимый(i + 1);
    const next = s[j];
    // Ключ объекта кончается только перед двоеточием.
    if (ключ) return next === ':';
    if (next === undefined) return true;
    const верх = стек[стек.length - 1];
    if (next === '}' || next === ']') {
      if ((next === '}' && верх !== '{') || (next === ']' && верх !== '[')) return false;
      const k = значимый(j + 1);
      return k >= s.length || /[,}\]`]/.test(s[k]);
    }
    if (next === ',') {
      const k = значимый(j + 1);
      if (k >= s.length) return true;
      // В объекте после запятой идёт следующий ключ: «"имя":».
      if (верх === '{') return s[k] === '}' || /^"[^"\\\n]{0,60}"\s*:/.test(s.slice(k, k + 70));
      return /^(?:["{\[\]\-\d]|true|false|null)/.test(s.slice(k, k + 5));
    }
    return false;
  };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (!inString) {
      out += ch;
      if (ch === '"') {
        inString = true;
        ключ = стек[стек.length - 1] === '{' && (последний === '{' || последний === ',');
      } else if (ch === '{' || ch === '[') { стек.push(ch); последний = ch; }
      else if (ch === '}' || ch === ']') { стек.pop(); последний = ch; }
      else if (!/\s/.test(ch)) последний = ch;
      continue;
    }
    if (escaped) { out += ch; escaped = false; continue; }
    if (ch === '\\') { out += ch; escaped = true; continue; }
    if (ch !== '"') { out += ch; continue; }
    if (можноЗакрыть(i)) { out += ch; inString = false; последний = '"'; } else out += '\\"';
  }
  return out;
}

export function scoreHudJsonCandidate(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return -Infinity;

  const has = (...keys) => keys.some(key => Object.prototype.hasOwnProperty.call(parsed, key));
  let score = 0;

  // A model response can contain several valid JSON objects. Only one of
  // them is the HUD payload; prefer the object whose top-level shape matches
  // the HUD schema instead of blindly taking the first parseable object.
  // Короткие коды корня (sc, cs, us…) — то, что модель пишет по промту.
  if (has('scene', 'сцена', 'Scene', 'sc')) score += 12;
  if (has('characters', 'character', 'персонажи', 'Characters', 'cs')) score += 12;
  if (has('user', 'пользователь', 'User', 'us')) score += 7;
  if (has('intercepts', 'перехваты', 'tp', 'taps')) score += 3;
  if (has('diary', 'дневник', 'dy')) score += 3;
  if (has('dreams', 'dream', 'сны', 'сновидения', 'dr')) score += 3;
  if (has('world', 'мир', 'wd')) score += 3;

  const scene = parsed.scene ?? parsed['сцена'] ?? parsed.Scene ?? parsed.sc;
  const chars = parsed.characters ?? parsed.character ?? parsed['персонажи'] ?? parsed.Characters ?? parsed.cs;
  if (scene && typeof scene === 'object' && !Array.isArray(scene)) score += 4;
  if (Array.isArray(chars)) score += 4;
  else if (chars && typeof chars === 'object') score += 2;

  return score;
}

function tryParseHudJsonCandidate(candidate) {
  const raw = String(candidate || '');
  const controlSafe = repairHudJsonControlChars(raw);
  const stateful = repairHudJsonUnterminatedString(controlSafe);
  const structural = repairHudJsonStructural(controlSafe);

  const attempts = [
    { text: raw, mode: 'direct' },
    { text: controlSafe, mode: 'control-chars' },
    { text: repairHudJsonInnerQuotes(controlSafe), mode: 'inner-quotes' },
    { text: repairHudJsonSyntax(repairHudJsonInnerQuotes(controlSafe)), mode: 'inner-quotes+syntax' },

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

function repairHudJsonSyntax(jsonStr) {
  let repaired = String(jsonStr || '');
  repaired = repaired.replace(/^\uFEFF/, '').trim();
  // Remove JS-style comments only when they are on their own line; do not
  // touch comment-like content inside JSON strings.
  repaired = repaired.replace(/(^|\n)\s*\/\/[^\n]*/g, '$1');
  repaired = repaired.replace(/,\s*([}\]])/g, '$1');
  return repaired;
}

function repairTruncatedHudJson(jsonStr) {
  let s = repairHudJsonSyntax(jsonStr).trim();
  if (!s) return s;
  // Remove a terminal backslash that escapes a character which never arrived.
  let inString = false, escaped = false, stack = [];
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
  const match = source.match(hudBlockRe('i', true));
  if (!match) {
    throw new Error('Не удалось найти HUD в ответе ИИ. Попробуйте еще раз.');
  }
  const rawInner = match[1] || '';
  try {
    const parsed = parseHUDComplex(rawInner);
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
      console.debug('[TavernOS HUD] HUD JSON repair result', { mode: selected.mode, candidates: candidates.length });
      return `[HUD]\n\`\`\`json\n${JSON.stringify(selected.parsed, null, 2)}\n\`\`\`\n[/HUD]`;
    }
    throw new Error('HUD JSON repair failed: ' + (lastError?.message || 'invalid JSON'));
  }
}

/* --- YAML как запасной вариант -------------------------------------------
   Поддерживаем ровно то, что встречается в ответах: отображения по
   отступам, списки через дефис, скаляры в кавычках и без. Якоря, ссылки,
   блочные скаляры и потоковый синтаксис сознательно не поддерживаем: они
   в ответах не появляются, а разбор бы усложнили втрое. */
function yamlScalar(сырое) {
  const s = String(сырое == null ? '' : сырое).trim();
  if (!s) return '';
  const первый = s[0];
  if ((первый === '"' || первый === "'") && s.length > 1 && s[s.length - 1] === первый) {
    const тело = s.slice(1, -1);
    return первый === '"' ? тело.replace(/\\n/g, '\n').replace(/\\"/g, '"') : тело;
  }
  if (s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  // Числами делаем только то, что целиком число: «21:47» и «+18°C» должны
  // остаться строками.
  if (/^-?\d+(?:\.\d+)?$/.test(s)) return Number(s);
  return s;
}

function yamlLines(текст) {
  const out = [];
  for (const сырая of String(текст || '').split(/\r?\n/)) {
    // Комментарий целой строкой убираем; хвостовые не трогаем — решётка
    // легко встречается внутри текста.
    if (/^\s*#/.test(сырая)) continue;
    if (!сырая.trim()) continue;
    if (/^\s*(---|\.\.\.)\s*$/.test(сырая)) continue;
    const отступ = сырая.match(/^\s*/)[0].replace(/\t/g, '  ').length;
    out.push({ отступ, текст: сырая.trim() });
  }
  return out;
}

// Обёртка: разбирает YAML и сразу проверяет, похоже ли это на HUD. Иначе
// любой список из двух строк объявлялся бы удачным разбором.
function пробаYaml(текст) {
  let разобрано = null;
  try { разобрано = parseSimpleYaml(текст); } catch (_) { return null; }
  if (!разобрано || typeof разобрано !== 'object' || Array.isArray(разобрано)) return null;
  if (scoreHudJsonCandidate(разобрано) <= 0) return null;
  return разобрано;
}

export function parseSimpleYaml(текст) {
  const строки = yamlLines(текст);
  if (!строки.length) return null;
  let i = 0;

  // Разбираем один уровень: всё, что глубже указанного отступа.
  const уровень = (минОтступ) => {
    // Что это — список или отображение — решает первая же строка уровня.
    const списком = строки[i] && строки[i].текст.startsWith('- ');
    const узел = списком ? [] : {};
    while (i < строки.length && строки[i].отступ >= минОтступ) {
      const { отступ, текст: стр } = строки[i];
      if (отступ > минОтступ && узел && !Array.isArray(узел) && !Object.keys(узел).length) {
        // Съехавший отступ у первой же строки — выравниваем по ней.
        return уровень(отступ);
      }
      if (отступ > минОтступ) break;

      if (стр.startsWith('- ') || стр === '-') {
        if (!Array.isArray(узел)) break;
        const хвост = стр === '-' ? '' : стр.slice(2).trim();
        i++;
        const пара = хвост.match(/^([^:]+):\s*(.*)$/);
        if (пара) {
          // «- ключ: значение» — начало объекта внутри списка. Его
          // остальные поля идут следующими строками с большим отступом.
          const объект = {};
          объект[пара[1].trim()] = пара[2].trim() ? yamlScalar(пара[2]) : (строки[i] && строки[i].отступ > отступ ? уровень(строки[i].отступ) : '');
          while (i < строки.length && строки[i].отступ > отступ && !строки[i].текст.startsWith('- ')) {
            const вложПара = строки[i].текст.match(/^([^:]+):\s*(.*)$/);
            if (!вложПара) { i++; continue; }
            const глубже = строки[i].отступ;
            i++;
            объект[вложПара[1].trim()] = вложПара[2].trim()
              ? yamlScalar(вложПара[2])
              : (строки[i] && строки[i].отступ > глубже ? уровень(строки[i].отступ) : '');
          }
          узел.push(объект);
        } else if (хвост) {
          узел.push(yamlScalar(хвост));
        } else if (строки[i] && строки[i].отступ > отступ) {
          узел.push(уровень(строки[i].отступ));
        }
        continue;
      }

      const пара = стр.match(/^([^:]+):\s*(.*)$/);
      if (!пара) { i++; continue; }
      if (Array.isArray(узел)) break;
      const ключ = пара[1].trim().replace(/^["']|["']$/g, '');
      const значение = пара[2].trim();
      i++;
      if (значение) { узел[ключ] = yamlScalar(значение); continue; }
      узел[ключ] = (i < строки.length && строки[i].отступ > отступ) ? уровень(строки[i].отступ) : '';
    }
    return узел;
  };

  const итог = уровень(строки[0].отступ);
  // Пустой объект — значит на самом деле это был не YAML.
  if (!итог || typeof итог !== 'object' || (!Array.isArray(итог) && !Object.keys(итог).length)) return null;
  return итог;
}

// Метка снимка «<new this turn>», переписанная моделью дословно, — не
// содержание: на экран её не пускаем, поле считается пустым.
const МЕТКА_НОВОГО = /^\s*<\s*new this turn\b[^>]*>\s*$/i;
function безМеток(v) {
  if (Array.isArray(v)) return v.filter(x => !(typeof x === 'string' && МЕТКА_НОВОГО.test(x))).map(безМеток);
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) {
      if (typeof v[k] === 'string' && МЕТКА_НОВОГО.test(v[k])) v[k] = '';
      else v[k] = безМеток(v[k]);
    }
  }
  return v;
}

// Разобранный HUD и нормализованный для отрисовки.
export function parseHUDComplex(contentEncoded) {
  return normalizeJSONData(безМеток(разобратьHUDСырой(contentEncoded)));
}

// Сырой HUD: объект в том виде, в каком его написала модель, — с короткими
// кодами и без подставленных схемой «empty». Нужен снимку последнего HUD в
// инструкции: модель обновляет свой же формат, а не развёрнутую копию.
export function разобратьHUDСырой(contentEncoded) {
  const decoded = decodeHighlightedHudHtml(contentEncoded);
  const candidates = extractBalancedJsonCandidates(decoded);
  if (!candidates.length) {
    const firstBrace = decoded.indexOf('{');
    if (firstBrace >= 0) candidates.push(decoded.slice(firstBrace));
  }
  if (!candidates.length) {
    // Фигурных скобок нет вовсе — возможно, модель ответила YAML.
    const yaml = пробаYaml(decoded);
    if (yaml) return yaml;
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

    if (parsedCandidates.length > 1) {
      console.debug('[TavernOS HUD] Multiple JSON candidates detected; selected HUD-shaped candidate', {
        candidates: candidates.length,
        parsed: parsedCandidates.length,
        selectedCandidate: selected.index,
        selectedScore: selected.score,
        scores: parsedCandidates.map(item => ({ index: item.index, score: item.score, mode: item.mode })),
      });
    }
    if (repaired) console.debug('[TavernOS HUD] HUD JSON repaired', { mode: selected.mode, candidates: candidates.length });
    return selected.parsed;
  }

  const preview = decoded.slice(0, 500).replace(/\n/g, '\\n');
  console.error('[TavernOS HUD] All HUD JSON candidates failed', {
    candidates: candidates.length,
    preview,
    error: lastError && lastError.message,
    repaired: false,
  });
  throw new Error('HUD JSON parse failed: ' + (lastError ? lastError.message : 'invalid JSON'));
}
