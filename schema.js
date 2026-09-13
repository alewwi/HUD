// hud-manager/schema.js
//
// Нормализация схемы HUD: канонизация ключей и добивка пропущенных полей
// значениями по умолчанию. Модель регулярно опускает часть ключей — здесь
// они восстанавливаются, чтобы рендер не спотыкался о undefined.
//
// Правила видимости UI намеренно не трогаются: пустые NSFW-значения
// остаются скрываемыми.

import { settings } from './settings.js?v=22.99.22';
import { getSafeUserName, mapKey } from './utils.js?v=22.99.22';
import { mergeCharacterRecords } from './render/relations-graph.js?v=22.99.22';
import { развернутьКоды, строкаМаршрута, строкаПрогноза, строкаГороскопа, строкаСообщения, настроениеТела, настроениеДневника, уровеньСекрета, огласкаСекрета, видСобытия, фазаБлизости } from './codes.js?v=22.99.22';

// Fixed schema defaults. This repairs omitted non-NSFW keys after generation.
// UI visibility rules are intentionally left intact: empty NSFW values remain hideable.
// Набор обязан совпадать с тем, что просит промт в index.js: схема
// подставляет 'empty' всему, чего модель не прислала, и именно это обещано
// строкой «SCHEMA FIXED ... never drop a key». Отрисовка значение 'empty'
// пропускает, поэтому лишних строк в карточке от этого не появляется.
const HUD_CHARACTER_DEFAULTS = { N:'empty', A:'empty', C:'empty', Ap:'empty', R:'empty', B:'empty', H:'empty', Ph:'empty', L:'empty', Th:'empty', K:'empty', Exp:'empty', D:'empty', I:'empty', G:'empty', S:'empty', Rel:'empty', Mem:'empty', Flag:'empty', Jls:'empty', St:'empty', Exo:'empty', X:'empty', SexLast:'empty', SexCount:'empty', SexReg:'empty', Lines:'empty', Trust:'empty', Fears:'empty', SceneState:'empty', BodyMap:'empty', W:'empty', Kink:'empty', Fet:'empty', NoGo:'empty', NoTurn:'empty', NSFW_Det:'empty', Aftercare:'empty', SexRev:'empty' };
const HUD_USER_DEFAULTS = { A:'empty', C:'empty', Ap:'empty', H:'empty', Rel:'empty', L:'empty', UW:'empty' };
const HUD_SCENE_DEFAULTS = { T:'empty', Wth:'empty', Dt:'empty', Atm:'empty', Md:'empty' };
const HUD_MEMORY_DEFAULTS = { timeline:[], mood:{ user:{current:'empty',history:[]}, char:{current:'empty',history:[]} }, route:{user:[],char:[]}, important:[], secrets:[], guns:[] };
const HUD_WORLD_DEFAULTS = { headlines:[], rumors:[], forecast:[], horoscope:[], prediction:[], ads:[], comments:[] };
const cloneSchemaDefault = v => Array.isArray(v) ? [] : (v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k,x]) => [k,cloneSchemaDefault(x)])) : v);
function fillMissingObjectFields(obj, defaults) {
  // Canonicalize aliases BEFORE applying defaults. Otherwise a model that emits
  // display-language keys (e.g. "Время") gets a second alias key (e.g. "T")
  // added by the defaults, and the later key-mapping pass can overwrite the
  // real value with "empty". Preserve actual values; use defaults only for
  // fields that are genuinely absent.
  const out = {};
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj)) {
      const canonicalKey = mapKey(key);
      // Prefer an explicitly canonical/display-language key over an alias if
      // both are present in the same object. This prevents "Имя" being
      // replaced by a stale "N" value (or vice versa).
      if (!(canonicalKey in out) || key === canonicalKey) out[canonicalKey] = value;
    }
  }
  for (const [key, def] of Object.entries(defaults)) {
    const canonicalKey = mapKey(key);
    if (out[canonicalKey] === undefined || out[canonicalKey] === null) {
      out[canonicalKey] = cloneSchemaDefault(def);
    }
  }
  return out;
}
function fillMemoryFields(obj, defaults) {
  const out = {};
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj)) {
      const n = String(key ?? '').trim().toLowerCase().replace(/[ё]/g, 'е').replace(/[\s_-]+/g, ' ');
      let canonicalKey = key;
      if (n === 'timeline' || n === 'таймлайн') canonicalKey = 'timeline';
      else if (n === 'mood' || n === 'настроение' || n === 'эмоции' || n === 'эмоция') canonicalKey = 'mood';
      else if (n === 'route' || n === 'маршрут' || n === 'маршруты') canonicalKey = 'route';
      else if (n === 'important' || n === 'важное') canonicalKey = 'important';
      else if (n === 'secrets' || n === 'секреты') canonicalKey = 'secrets';
      else if (n === 'guns' || n === 'ружья' || n === 'ружья чехова') canonicalKey = 'guns';
      if (!(canonicalKey in out) || key === canonicalKey) out[canonicalKey] = value;
    }
  }
  for (const [key, def] of Object.entries(defaults)) {
    if (out[key] === undefined || out[key] === null) out[key] = cloneSchemaDefault(def);
  }
  return out;
}

function fillMoodActorFields(obj, defaults) {
  const out = {};
  if (typeof obj === 'string') {
    out.current = obj;
    out.history = [];
  } else if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj)) {
      const n = String(key ?? '').trim().toLowerCase().replace(/[ё]/g, 'е').replace(/[\s_-]+/g, ' ');
      const canonicalKey = (n === 'current' || n === 'текущее' || n === 'текущее настроение' || n === 'сейчас') ? 'current'
        : (n === 'history' || n === 'история') ? 'history'
        : key;
      if (!(canonicalKey in out) || key === canonicalKey) out[canonicalKey] = value;
    }
  }
  for (const [key, def] of Object.entries(defaults)) {
    if (out[key] === undefined || out[key] === null) out[key] = cloneSchemaDefault(def);
  }
  return out;
}

function normalizeHUDSchema(parsed) {
  const root = (parsed && typeof parsed === 'object') ? parsed : {};
  // Модель пишет разделы короткими кодами (chats, taps, log, tx…). Разворачиваем
  // их первыми, чтобы дальше работать с привычными названиями.
  развернутьКоды(root);
  root.scene = fillMissingObjectFields(root.scene, HUD_SCENE_DEFAULTS);
  root.characters = Array.isArray(root.characters) ? root.characters.map(c => fillMissingObjectFields(c, HUD_CHARACTER_DEFAULTS)) : [];
  if (settings.enableUserBlock) root.user = fillMissingObjectFields(root.user, HUD_USER_DEFAULTS);
  if (settings.enableMemory) {
    root.memory = fillMemoryFields(root.memory, HUD_MEMORY_DEFAULTS);
    root.memory.mood = fillMoodActorFields(root.memory.mood, HUD_MEMORY_DEFAULTS.mood);
    root.memory.mood.user = fillMoodActorFields(root.memory.mood.user, HUD_MEMORY_DEFAULTS.mood.user);
    root.memory.mood.char = fillMoodActorFields(root.memory.mood.char, HUD_MEMORY_DEFAULTS.mood.char);
    root.memory.route = fillMemoryFields(root.memory.route, HUD_MEMORY_DEFAULTS.route);
  }
  if (settings.enablePhone && (!root.chatsMap || typeof root.chatsMap !== 'object' || Array.isArray(root.chatsMap))) root.chatsMap = {};
  if (settings.enableIntercepts && !Array.isArray(root.intercepts)) root.intercepts = [];
  if (settings.enableDiary && !Array.isArray(root.diary)) root.diary = [];
  if (settings.enableDreams && !Array.isArray(root.dreams)) root.dreams = [];
  if (settings.enableWorld) root.world = fillMissingObjectFields(root.world, HUD_WORLD_DEFAULTS);
  return root;
}

export function normalizeJSONData(parsed) {
  parsed = normalizeHUDSchema(parsed);
  const userName = getSafeUserName();
  const charName = window.name2 || 'Char';
  const toStr = (v) => v === null || v === undefined ? '' : String(v);
  // Local safety predicate used by Memory normalization. Keep it here because
  // the parser must not depend on a renderer-scoped helper.
  const valid = (v) => v !== null && v !== undefined && String(v).trim() !== '' && !/^(empty|none)$/i.test(String(v).trim());
  const normalizeValue = (v) => {
    if (v === null || v === undefined) return '';
    if (Array.isArray(v)) return v.map(normalizeValue);
    if (typeof v === 'object') {
      const out = {};
      for (const key of Object.keys(v)) out[mapKey(key)] = normalizeValue(v[key]);
      return out;
    }
    return String(v);
  };
  const mapKeys = (obj) => {
    if (typeof obj !== 'object' || obj === null) return {};
    const res = {};
    for (const k of Object.keys(obj)) res[mapKey(k)] = normalizeValue(obj[k]);
    return res;
  };
  const toArr = (v) => Array.isArray(v) ? v.map(toStr) : (v ? [toStr(v)] : []);
  const cleanArray = (arr) => { return toArr(arr).filter(item => { let lower = item.toLowerCase(); return !lower.includes('generate unlimited') && !lower.includes('n amount') && !lower.includes('generate at least'); }); };

  let chars = Array.isArray(parsed.characters) ? parsed.characters : (typeof parsed.characters === 'object' && parsed.characters !== null ? [parsed.characters] : []);
  chars = mergeCharacterRecords(chars);
  let world = parsed.world || {};
  // Список участников осмыслен только для настоящей группы — троих и
  // больше. Промт этого требует и прямо обещает, что короткие списки
  // отбрасываются, но отбрасывать было некому: модель регулярно присылает
  // одно-два имени, и в шапке переписки появлялась бессмысленная плашка
  // «Участники: Аня». Отсекаем здесь, в нормализации, чтобы правило
  // действовало сразу для всех потребителей — и для телефона, и для
  // перехватов, — а не в каждом рендерере по отдельности.
  const groupParticipants = (value) => {
    const names = toStr(value)
      .split(/[;,]/)
      .map(s => s.trim())
      .filter(s => s && !/^(нет|none|empty|n\/a|-|—)$/i.test(s));
    return names.length >= 3 ? names.join('; ') : '';
  };

  let chatsMap = {};
  if (typeof parsed.chatsMap === 'object' && parsed.chatsMap !== null) {
    for (const k of Object.keys(parsed.chatsMap)) {
      const c = parsed.chatsMap[k];
      if (!c || typeof c !== 'object') continue;
      // Статус (ur, dl…) и исход звонка приходят кодами — разворачиваем в слова,
      // которые ищут переписка и уведомления.
      chatsMap[toStr(k)] = { owner: toStr(c.owner), participants: groupParticipants(c.participants), messages: cleanArray(c.messages).map(строкаСообщения) };
    }
  }
  let interceptsParsed = [];
  if (Array.isArray(parsed.intercepts)) {
    interceptsParsed = parsed.intercepts.map(i => {
      if (typeof i === 'object' && i !== null) return { target: toStr(i.target), chatName: toStr(i.chatName), participants: groupParticipants(i.participants), messages: cleanArray(i.messages).map(строкаСообщения) }; return null;
    }).filter(Boolean);
  }
  let diaryParsed = [];
  if (Array.isArray(parsed.diary)) {
    diaryParsed = parsed.diary.map(d => {
      if (typeof d === 'string') return { author:'', time:'', text:d, aboutUser:'', mood:'', emotion:'' };
      if (typeof d === 'object' && d !== null) return {
        author: toStr(d.author),
        time: toStr(d.time),
        text: toStr(d.text),
        aboutUser: toStr(d.aboutUser),
        mood: настроениеДневника(toStr(d.mood || d.emotion || '')),
        emotion: настроениеДневника(toStr(d.emotion || d.mood || ''))
      };
      return null;
    }).filter(Boolean);
  }
  // Дневник тела — те же записи, что и в обычном дневнике, но про близость.
  // Разбираем отдельным списком: у него своя вкладка и своё оформление.
  let bodyDiaryParsed = [];
  if (Array.isArray(parsed.bodyDiary)) {
    bodyDiaryParsed = parsed.bodyDiary.map(d => {
      if (typeof d === 'string') return { author: '', time: '', text: d, mood: '' };
      if (d && typeof d === 'object') return {
        author: toStr(d.author), time: toStr(d.time),
        text: toStr(d.text), mood: настроениеТела(toStr(d.mood || d.emotion || '')),
      };
      return null;
    }).filter(d => d && valid(d.text));
  }

  let dreamsParsed = [];
  if (Array.isArray(parsed.dreams)) {
    dreamsParsed = parsed.dreams.map(d => {
      if (typeof d === 'string') return { text: d, meaning: '' }; 
      if (typeof d === 'object' && d !== null) return { text: toStr(d.text), meaning: toStr(d.meaning) }; return null;
    }).filter(d => d !== null);
  }

  // Спутники: животные, фамильяры, дроны. Строка вместо объекта — одно имя.
  const companionsParsed = (Array.isArray(parsed.companions) ? parsed.companions : [])
    .map(p => {
      if (typeof p === 'string') return { name: toStr(p), species: '', owner: '', mood: '', condition: '', diet: '', bond: '', skills: '', note: '' };
      if (!p || typeof p !== 'object') return null;
      const поле = (k) => toStr(Array.isArray(p[k]) ? p[k].join('; ') : p[k]);
      return { name: поле('name'), species: поле('species'), owner: поле('owner'), mood: поле('mood'),
        condition: поле('condition'), diet: поле('diet'), bond: поле('bond'), skills: поле('skills'), note: поле('note') };
    })
    .filter(p => p && valid(p.name));

  // === ПАРСЕР ПАМЯТИ ===
  let memoryParsed = { timeline: [], mood: { user: { current: '', history: [] }, char: { current: '', history: [] } }, route: { user: [], char: [] }, important: [], secrets: [], guns: [] };
  if (parsed.memory && typeof parsed.memory === 'object') {
      memoryParsed.timeline = cleanArray(parsed.memory.timeline).slice(-5);
      memoryParsed.important = typeof parsed.memory.important === 'string' ? parsed.memory.important.split(';').map(s=>s.trim()).filter(Boolean) : cleanArray(parsed.memory.important);
      // Ружья Чехова: строка «завязка | к кому относится | статус».
      memoryParsed.guns = cleanArray(parsed.memory.guns).filter(valid);
      const rawMood = parsed.memory.mood;
      if (rawMood && typeof rawMood === 'object' && !Array.isArray(rawMood)) {
          const extractActorMood = (value) => {
              if (value && typeof value === 'object' && !Array.isArray(value)) {
                  return {
                      current: toStr(value.current || value.текущее || value['текущее настроение'] || ''),
                      history: cleanArray(value.history || value.история || []).slice(-12)
                  };
              }
              if (value !== null && value !== undefined && String(value).trim()) return { current: toStr(value), history: [] };
              return { current: '', history: [] };
          };
          // Support both the canonical {user, char} shape and Russian aliases.
          const u = rawMood.user ?? rawMood.юзер ?? rawMood['пользователь'] ?? rawMood['{{user}}'];
          const c = rawMood.char ?? rawMood.персонаж ?? rawMood['персонаж'] ?? rawMood['{{char}}'];
          memoryParsed.mood.user = extractActorMood(u);
          memoryParsed.mood.char = extractActorMood(c);

          // If the model supplied a shared mood string instead of separate actors,
          // use it for both so the UI never falls back to a misleading empty value.
          if (!memoryParsed.mood.user.current && !memoryParsed.mood.char.current) {
              const shared = toStr(rawMood.current || rawMood.value || rawMood.текущее || '');
              if (shared) {
                  memoryParsed.mood.user.current = shared;
                  memoryParsed.mood.char.current = shared;
              }
          }
      } else if (rawMood) {
          const shared = toStr(rawMood);
          memoryParsed.mood.user.current = shared;
          memoryParsed.mood.char.current = shared;
      }
      if (parsed.memory.route && typeof parsed.memory.route === 'object') {
          // Действие в конце строки модель пишет кодом (arr, left…). Переводим
          // здесь, а не в отрисовке: перенос прошлых ходов сравнивает строки, и
          // «прибытие» и «arr» у одной точки не должны стать двумя остановками.
          memoryParsed.route.user = cleanArray(parsed.memory.route.user).slice(-20).map(строкаМаршрута);
          memoryParsed.route.char = cleanArray(parsed.memory.route.char).slice(-20).map(строкаМаршрута);
      }
      if (Array.isArray(parsed.memory.secrets)) {
          memoryParsed.secrets = parsed.memory.secrets.map(s => {
              if (!s || typeof s !== 'object') return null;
              const status = огласкаСекрета(toStr(s.status || s.state || 'unknown')).toLowerCase();
              if (s.revealed === true || /^(revealed|раскрыт|раскрыто|known_to_all)$/.test(status)) return null;
              const splitNames = (value) => {
                  if (Array.isArray(value)) return value.flatMap(x => {
                      if (x && typeof x === 'object') return [toStr(x.name || x.who)];
                      return String(x || '').split(/[;,]/).map(v => v.trim());
                  }).filter(valid);
                  if (!valid(value)) return [];
                  return String(value).split(/[;,]/).map(v => v.trim()).filter(valid);
              };
              const rawKnows = Array.isArray(s.knows) ? s.knows : splitNames(s.knows).map(name => ({name, source: ''}));
              const knows = rawKnows.flatMap(k => {
                  if (k && typeof k === 'object') {
                      const names = splitNames(k.name || k.who);
                      return names.map(name => ({name, source: toStr(k.source || '')}));
                  }
                  return splitNames(k).map(name => ({name, source: ''}));
              }).filter(k => valid(k.name));
              const hiddenRaw = s.hidden ?? s.doesNotKnow ?? s.unknown ?? s.notKnow ?? s.notKnown;
              let hidden = splitNames(hiddenRaw);
              if (!hidden.length) {
                  const activeNames = [];
                  const addName = v => {
                      const n = toStr(v).trim();
                      if (valid(n) && !activeNames.some(x => x.toLowerCase() === n.toLowerCase())) activeNames.push(n);
                  };
                  const userObj = parsed.user && typeof parsed.user === 'object' ? parsed.user : {};
                  addName(userObj.N || userObj.name || userObj['Имя'] || userObj['Name']);
                  (Array.isArray(parsed.characters) ? parsed.characters : []).forEach(c => {
                      if (c && typeof c === 'object') addName(c.N || c.name || c['Имя'] || c['Name']);
                  });
                  const knownSet = new Set(knows.map(k => k.name.toLowerCase()));
                  hidden = activeNames.filter(n => !knownSet.has(n.toLowerCase()));
              }
              return { fact: toStr(s.fact), level: уровеньСекрета(toStr(s.level || 'medium')).toLowerCase(), status, knows, hidden };
          }).filter(s => s && valid(s.fact));
      }
  }

  // Телефонная ОС: контакты, галерея, заметки, карты, поисковые запросы.
  // Каждая секция необязательна — приложение без данных покажет пустой экран.
  const phoneSection = (arr, fields) => (Array.isArray(arr) ? arr : [])
    .map(item => {
      if (typeof item === 'string') return { [fields[0]]: toStr(item) };
      if (!item || typeof item !== 'object') return null;
      const out = {};
      fields.forEach(f => { out[f] = toStr(item[f]); });
      return out;
    })
    .filter(o => o && Object.values(o).some(v => v));
  const rawPhone = (parsed.phone && typeof parsed.phone === 'object' && !Array.isArray(parsed.phone)) ? parsed.phone : {};
  const phoneParsed = {
    owner: toStr(rawPhone.owner),
    contacts: phoneSection(rawPhone.contacts, ['name', 'note']),
    gallery:  phoneSection(rawPhone.gallery,  ['title', 'time', 'desc', 'meta']),
    notes:    phoneSection(rawPhone.notes,    ['title', 'time', 'text', 'footer']),
    maps:     phoneSection(rawPhone.maps,     ['place', 'note']),
    search:   cleanArray(rawPhone.search),
    // Кошелёк: баланс и валюта строками, движения по счёту — списком.
    // Карты телефон рисует сам, модель их не выдумывает.
    wallet: (() => {
      const w = (rawPhone.wallet && typeof rawPhone.wallet === 'object' && !Array.isArray(rawPhone.wallet)) ? rawPhone.wallet : {};
      const tx = phoneSection(w.transactions, ['title', 'amount', 'time', 'note']);
      const balance = toStr(w.balance), currency = toStr(w.currency);
      return (balance || currency || tx.length) ? { balance, currency, transactions: tx } : null;
    })(),
    calendar: phoneSection(rawPhone.calendar, ['date', 'title', 'kind', 'time']).map(с => ({ ...с, kind: видСобытия(с.kind) })),
  };

  return {
    // Фаза близости приходит кодом (fp, cx…); шкала фаз узнаёт полные слова.
    scene: mapKeys(parsed.scene), characters: chars.map(mapKeys).map(c => { if (c['Фаза близости']) c['Фаза близости'] = фазаБлизости(c['Фаза близости']); return c; }), user: mapKeys(parsed.user), memory: memoryParsed, chatsMap: chatsMap, phone: phoneParsed, intercepts: interceptsParsed, diary: diaryParsed, bodyDiary: bodyDiaryParsed, dreams: dreamsParsed, companions: companionsParsed,
    world: { headlines: cleanArray(world.headlines), rumors: cleanArray(world.rumors),
             // Период, погода, знак и тон приходят кодами — на экран по-русски.
             forecast: cleanArray(world.forecast).map(строкаПрогноза), horoscope: cleanArray(world.horoscope).map(строкаГороскопа),
             prediction: cleanArray(world.prediction),
             ads: cleanArray(world.ads), comments: cleanArray(world.comments) }
  };
}
