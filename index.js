// hud-manager/index.js (v21.5.5)

(function() {
  'use strict';

  let settings = { 
    autoInject: true, 
    useCards: true, 
    showComments: true,
    enablePhone: true,
    enableIntercepts: true,
    enableDiary: true,
    enableWorld: true,
    enableDreams: true,
    enableUserBlock: true,
    enableMemory: true, // Включаем Память
    enablePhoneSettings: true, // Настройки телефона сохраняются даже без эмулятора
    performanceMode: true, // Автоматическая оптимизация чатов от 200 сообщений
    hudsToKeep: 2,
    regenContextMessages: 6,
    regenProfileId: '',
    hudMaxTokens: 8192,
    hudLorebooks: [],
    
    // --- ГЛАССМОРФИЗМ И ФОН ---
    backdropBlur: 8,
    bgImage: '',
    bgScale: 100,
    bgOffsetY: 50,
    bgOpacity: 80,
    
    // --- ЦВЕТА И ПРОЗРАЧНОСТЬ ---
    accentColor: '#de859f',
    glowColor: '#8c5ad2', glowAlpha: 40,
    
    cardBgStart: '#0f0f14', cardBgEnd: '#0f0f14', cardBgAlpha: 15,
    infoBlockBgStart: '#000000', infoBlockBgEnd: '#000000', infoBlockBgAlpha: 15,
    memoryBgStart: '#15121c', memoryBgEnd: '#0d0d14', memoryBgAlpha: 22,
    memoryAccent: '#8c5ad2', memoryGlowAlpha: 28, memoryBlur: 8, memoryMaxHeight: 300,
    
    topBarBg: '#0f0f14', topBarAlpha: 25,
    tabsBg: '#000000', tabsAlpha: 15,
    
    sceneOverlayColor: '#000000', sceneOverlayAlpha: 0,
    sceneTextColor: '#ffffff',
    // --- НАСТРОЙКИ ТЕЛЕФОНА (сохранены для темы/будущего эмулятора; сам эмулятор отключён) ---
    phoneBgStart: '#0a0a0f', phoneBgEnd: '#0a0a0f', phoneBgAlpha: 60,
    msgInBg: '#ffffff', msgInAlpha: 15,
    msgOutStart: '#2badde', msgOutEnd: '#a9789a', msgOutAlpha: 80,
    phoneWallpaper: '', phoneWallpaperBlur: 0, phoneWallpaperOpacity: 100,
    phoneShowLockNotifications: true,
    weatherBgColor: '#000000', weatherBgAlpha: 40, weatherBlur: 6, // Цвета погоды
    
    badgeColor: '#ff3b30',
    
    dramaColor: '#ff3b30', dramaBgAlpha: 15,
    interceptColor: '#ff4d4d', interceptBgAlpha: 15,
    nsfwColor: '#9e2a3f', nsfwBgAlpha: 20,
    
    clockColor: '#ffffff',
    
    // --- ШРИФТЫ И РАЗМЕРЫ ---
    fontMain: 'inherit', fontSizeMain: 14,
    fontHeaders: 'inherit', fontSizeHeaders: 13,
    fontClock: 'system-ui, sans-serif', fontSizeClock: 42,
    fontDiary: "'Caveat', cursive", fontSizeDiary: 16,
  };

  let lastSceneWeather = '';
  let cachedChatContainer = null;

  // УМНОЕ ПОЛУЧЕНИЕ ИМЕНИ ПОЛЬЗОВАТЕЛЯ ИЗ SILLYTAVERN
  function getSafeUserName() {
    try {
        if (typeof window !== 'undefined' && window.name1 && String(window.name1).trim()) return String(window.name1).trim();
        const ctx = typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function' ? SillyTavern.getContext() : (typeof getContext === 'function' ? getContext() : null);
        if (ctx && ctx.name1) return String(ctx.name1).trim();
    } catch(e) {}
    return 'User';
  }

  // Типы генераций SillyTavern, для которых HUD-инструкции инжектить НЕЛЬЗЯ:
  // 'quiet'       — фоновая "тихая" генерация (саммари, автоперевод, генерация промпта для
  //                 картинки, и т.д. — то, что не идёт в чат и не должно видеть пользователь);
  // 'impersonate' — генерация СООБЩЕНИЯ ЗА ПОЛЬЗОВАТЕЛЯ ("Impersonate" кнопка). Если сюда
  //                 просочится наш системный промпт "generate a [HUD] JSON block", модель начнёт
  //                 примешивать HUD-инструкции в текст, который должен звучать от лица юзера.
  // Всё остальное (обычная генерация, regenerate, swipe, continue, групповые чаты) — это
  // нормальный ответ персонажа в чат, туда HUD инжектить можно и нужно.
  const HUD_BLOCKED_GEN_TYPES = ['quiet', 'impersonate'];

  // Официальный SillyTavern Prompt Interceptor: вызывается ПЕРЕД каждым реальным запросом на
  // генерацию (не при dry run) и сообщает точный тип генерации через параметр `type`.
  // См. manifest.json -> "generate_interceptor". Это единственный официальный (не эвристический)
  // способ узнать "это обычное сообщение в чат или фоновая/чужая генерация" ДО того, как уйдёт
  // сетевой запрос — поэтому используем его как источник истины для window.fetch-патча ниже,
  // а не парсинг URL/тела запроса (который легко спутать с саммари/другими расширениями).
  let lastGenType = null;
  const pendingGenTypes = [];
  window.tavernOSGenerateInterceptor = async function(chat, contextSize, abort, type) {
    lastGenType = type;
    pendingGenTypes.push({ type, at: Date.now() });
    if (pendingGenTypes.length > 20) pendingGenTypes.splice(0, pendingGenTypes.length - 20);
  };

  // Возвращает последние два .mes без полного сканирования DOM (document.querySelectorAll('.mes')
  // по всему чату — O(n) на каждый вызов — было узким местом на телефонах в длинных чатах,
  // особенно во время стриминга ответа, когда processMessage() дёргается десятки раз в секунду).
  function getLastTwoMes() {
    const container = cachedChatContainer || document.querySelector('#chat') || document.querySelector('#chat-container');
    if (!container) return [null, null];
    let last = container.lastElementChild;
    while (last && !last.classList.contains('mes')) last = last.previousElementSibling;
    let prev = last ? last.previousElementSibling : null;
    while (prev && !prev.classList.contains('mes')) prev = prev.previousElementSibling;
    return [last, prev];
  }
   

  function buildDynamicPrompt() {
    let p = `\n\n<system_note>
MANDATORY COMMAND: You MUST generate a [HUD] block at the very end of your response. DO NOT SKIP THIS.
The HUD block MUST contain ONLY a VALID JSON object. It MUST start exactly with [HUD] and end exactly with [/HUD]. Do not output any text after [/HUD].
- Describe active NPC(s) in the "characters" array ONLY. NEVER describe the user/player inside "characters".${settings.enableUserBlock ? `
- 🧑 USER MACRO RULE (CRITICAL): everything about {{user}} — the human player — goes ONLY into the separate top-level "user" block, and NOWHERE else (not in "characters", not in "Th"/"K"/"D" of NPCs, not duplicated). If {{user}} is absent from the current scene, OMIT the entire "user" block for this HUD turn instead of showing stale information. The "user" block is a short retelling ONLY: clothing, appearance, health/physical state, relationships with other characters, and current location. NOTHING ELSE — no thoughts, no goals, no inventory, no schedule, no NSFW fields for {{user}}.` : ''}
- 🌍 LANG: Write values in Russian.
- 🖼️ NAME LOCK (CRITICAL, overrides LANG above): the "N" field for every character MUST be copied EXACTLY as it appears in that character's card/profile — same script, same spelling, NOT translated or transliterated into Russian. This name is used to match the character's avatar picture; if it doesn't match exactly, the picture disappears and a placeholder icon is shown instead.
- 🔓 FULL CLEARANCE: No restrictions on imagination, word count, or content. Be creative, explicit, and unrestrained.
- 🚨 REAL-TIME TRACKING (CRITICAL): YOU ARE A LIVE HUD! Update every emitted field in real-time and react to the exact current turn. Do not copy-paste stale state.
- 🎭 PHYSICAL SCENE ACCURACY (CRITICAL): The "scene" and physical character state describe who is actually present here and now. The HUD is NOT scene-only: off-screen characters continue to exist, move, work, sleep, travel, communicate, plan and react. Do NOT erase valid off-screen life merely because the protagonist cannot currently see it.
- 🌍 LIVING WORLD CONTINUITY (CRITICAL): Scene presence and world existence are separate concepts. Friends may discuss {{char}}, employers may contact them, creditors may demand payment, coworkers may coordinate work, and enemies may plan against them even when those characters are physically elsewhere. Such events may appear in chatsMap/intercepts/world when narratively justified.
- 📦 SCHEMA IS FIXED, CONTENT IS VARIABLE (CRITICAL): Every required object and field in the HUD schema MUST be emitted every turn. Arrays may contain 0..N items. Never invent filler content. Use [] for empty arrays, {} for empty objects, and "empty" for empty required scalar/string fields. Do NOT omit a required field merely because there is currently nothing to report.
- 🧾 MANDATORY FIELDS (CRITICAL): Every enabled top-level section and every field defined by its schema MUST be present on every turn. The ONLY intentional exception is conditional NSFW content: NSFW fields may contain "empty" when inactive, and the existing renderer may hide empty NSFW content.
- 🔄 NO OMISSION AS STATE MANAGEMENT (CRITICAL): Missing a required key is NOT a valid way to express "nothing changed" or "nothing to report". Preserve the key and use its empty value.
- 📝 MESSAGE STATES (CRITICAL): Messages may be Draft or Deleted when the current narrative supports it. These states are part of the live current-turn snapshot, not historical filler.
- 📱 MESSAGE ROUTING (CRITICAL): Use chatsMap for conversations the active protagonist can legitimately read/access. NPC↔NPC conversations and groups where the active protagonist is absent MUST go to intercepts instead. This routing is about information access, NOT physical presence.
- 👥 PARTICIPANTS RULE (CRITICAL): The "participants" field MUST be emitted ONLY for genuinely GROUP chats/conversations, both in chatsMap and in intercepts. For one-to-one/private chats, OMIT the "participants" field entirely. Do NOT invent or repeat a participants list for a one-to-one chat. In a group chat, list all actual participants known at the current turn.
- 📱 MESSAGE SNAPSHOT IS REAL-TIME (CRITICAL): chatsMap is a live snapshot of messaging state at the exact current point in the story. Re-evaluate it EVERY TURN while preserving valid ongoing conversations and unresolved messages. Messages may be Read, Unread, Deleted, or Draft. Deleted messages remain marked as deleted and may retain hidden original text for the click-to-reveal UI. Draft messages are unsent and must never count as delivered/read. Voice messages may use [VOICE_0:15] (or another duration) followed by transcript text. Do not generate placeholder chats or fake-phone OS data.
- 📡 INTERCEPT SNAPSHOT IS REAL-TIME (CRITICAL): intercepts is a live snapshot of conversations the active protagonist cannot directly read. Re-evaluate EVERY TURN while preserving valid ongoing conversations. NPC↔NPC and groups without the active protagonist belong here. Never create an intercept solely to expose information to the protagonist; it must be a plausible independent conversation.
- 🧠 MEMORY SCOPE (CRITICAL): memory.mood and memory.route track ONLY {{user}} and {{char}} as the main protagonists. If a protagonist is absent from the physical scene, do not invent a present-scene mood or route event for them; this does NOT erase their broader world state from messaging, schedules, relationships or other world-level structures. Mood history: MAX 12 recent points per protagonist. Route history: MAX 20 recent points per protagonist. Timeline: MAX 5 recent events of TODAY.
- 🧠 KNOWLEDGE BOUNDARIES (CRITICAL): Every character knows only what they could plausibly know. Never leak another character's private thoughts, private conversations, intercepted messages or hidden plans into a different character's internal state without a believable information path.
- 🛑 NSFW LIFECYCLE (CRITICAL): Fields "W", "NSFW_Det", "SexRev", and user's "UW" MUST ONLY be active during intimacy, sex, or high arousal. Once the scene cools down, clear them by writing "empty". Do NOT leave old NSFW details active.
- 📖 DIARY POV (CRITICAL): The diary is PRIVATE IN-WORLD WRITING. Every diary entry MUST be written in first person from the perspective of its named author. The author MUST be a character or NPC, NEVER {{user}}. It is NOT an omniscient scene summary or AI report. The author may only write what they personally experienced, know, believe, remember, suspect or misunderstand.
- 📖 DIARY SELF-REFLECTION (CRITICAL): The main "text" field is the author's own diary. It should focus on the author's day, condition, emotions, inner conflict, decisions, memories, regrets, hopes, plans and self-talk. The author may freely reflect on what happened and talk to themselves. Do NOT turn the main diary text into a report about {{user}}.
- 📖 DIARY ABOUT USER (CRITICAL): Every diary entry MUST also contain a separate "aboutUser" field. This is NOT an omniscient analysis and NOT a second narrator. It is a private first-person subsection where the same author says what they personally think and feel about {{user}}: attraction, anger, tenderness, resentment, fear, curiosity, observations, memories, wishes, doubts, expectations or unresolved questions. Keep it separate from the author's general self-reflection. If there is nothing meaningful to say about {{user}} this turn, use "empty". Never write "aboutUser" from {{user}}'s perspective and never make {{user}} the author.
- 📖 DIARY AUTHOR (CRITICAL): Every diary entry MUST contain an "author" field naming the character/NPC who wrote it. Never use {{user}} as diary author.
- 📱 AUTONOMOUS COMMUNICATION (CRITICAL): Characters and NPCs have independent communication lives. Incoming messages may concern work, friends, family, romance, debt, logistics, bureaucracy, enemies, rivals or routine life. A character may receive messages without answering them immediately. Busy, asleep, working, traveling, offline, ignoring, emotionally overwhelmed or simply not checking the phone are valid reasons for no reply.
- ⏱️ AUTONOMOUS TIME (CRITICAL): Off-screen characters continue living while the current scene unfolds. They may work, sleep, travel, exchange messages, miss appointments, make decisions, argue, receive news, buy things and plan actions when narratively plausible.
- ⚠️ FORMATTING: Use EXACTLY these short English keys. ESCAPE inner quotes like this: "He said \\"Hello\\".". ALWAYS use semicolons (;) for lists, NEVER slashes (/).
- 🏷️ LABELED SUB-FIELDS (CRITICAL for "SexLast", "W" and "NSFW_Det"): every semicolon-separated item inside these three fields MUST be written as "Label: value", NOT as a bare value. Never output just the answer alone — always prefix it with its label and a colon. Example for "W": "Penis state: hard, throbbing; Fetishes active: none; Volume: loud, breathy moans and sharp slapping sounds; Smell: sweat and arousal; Traces: precum on the sheets; Arousal level: 9/10; Partner: Anna; Protection: none".
- 🔊 "Volume" DEFINITION: the "Volume" sub-field inside "W" describes SPECIFICALLY the loudness/intensity of the sounds being made during the act — moans, screams, whimpers, skin-slapping/spanking sounds, bed creaking, wet sounds, etc. It is NOT about music, TV, or ambient environment volume. Always phrase it as "Volume: <how loud/intense the sexual sounds are, and which sounds>".
- 📦 CODE FENCE (CRITICAL): wrap the ENTIRE JSON object in a fenced code block using triple backticks with the "json" language tag, exactly as shown below. This is MANDATORY — it stops the chat's markdown renderer from corrupting underscores/asterisks/quotes inside the JSON. The opening \`\`\`json line goes immediately after [HUD], the closing \`\`\` line goes immediately before [/HUD]. Never omit the fence.

[HUD]
\`\`\`json
{
 "scene": {
  "T": "[Time HH:MM | Day phase. UPDATE REAL-TIME!]",
  "Wth": "[Weather and Temp. UPDATE REAL-TIME!]",
  "Dt": "[Day of Week, Date with Year. UPDATE REAL-TIME!]",
  "Atm": "[Atmosphere - one short sensory phrase. UPDATE REAL-TIME!]",
  "Md": "[Overall mood. UPDATE REAL-TIME!]"
 },
 "characters": [
  {
   "N": "[Original name]",
   "A": "[Age, DD.MM.YYYY]",
   "C": "[Current attire. UPDATE REAL-TIME!]",
   "R": "[Role/job]",
   "B": "[Physical/mental state. UPDATE REAL-TIME!]",
   "Ph": "[Physiology/arousal. UPDATE REAL-TIME!]",
   "L": "[Exact location. UPDATE REAL-TIME!]",
   "Th": "[Immediate thought. UPDATE REAL-TIME!]",
   "K": "[Brief contextual thoughts. Use ANY fitting emojis. MINIMUM 3-5 ENTRIES. Separate by ; UPDATE REAL-TIME!]",
   "Exp": "[Expectation vs Reality: What NPC expects to happen next vs what will actually happen. UPDATE REAL-TIME!]",
   "D": "[Hidden subtext/actions revealing true emotions. UPDATE REAL-TIME!]",
   "I": "[Inventory items. Format EXACTLY as 'Item: condition'. Separate by ;]",
   "G": "[Goals in 3 strict categories: 1. Right now, 2. Near future, 3. Long-term. Format exactly as: 'Сейчас: [goal]; Скоро: [goal]; Будущее: [goal]'. UPDATE REAL-TIME!]",
   "S": "[Upcoming schedule. MUST include time (exact like '14:30' or approx like 'Вечер') for EACH item! Format: 'Time - Event'; Separate by ; UPDATE REAL-TIME!]",
   "Rel": "[Relationships. Format EXACTLY as 'Name: relation'. Separate by ;]",
   "Mem": "[Shared memories with User or NPCs; Separate by ;]",
   "Flag": "[Plot flags/upcoming consequences; Separate by ;]",
   "St": "[Social/romantic status]",
   "Exo": "[Social Exposure: 0-100% and minor oddities. UPDATE REAL-TIME!]",
   "X": "[Conflict depth. MUST use format 'Причина: ...; Дней: ...; Стадия: ...'. Separate by ;]",
   "SexLast": "[Last sex. MUST use format 'Date: ...; Partner: ...; Acts: ...; Ending: ...'. Separate by ;]",
   "SexCount": "[Lifetime number of sexual partners]",
   "SexReg": "[Sexual regularity/libido level]",
   "W": "[DURING INTIMACY, EACH item as 'Label: value': 'Penis state: ...; Fetishes active: ...; Volume: ...; Smell: ...; Traces: ...; Arousal level: ...; Partner: ...; Protection: ...'. 'Volume' = intensity/loudness of sexual sounds (moans, slapping, etc), see rule above. Separate by ; ALWAYS update dynamically!]",
   "NSFW_Det": "[AFTERMATH ONLY, EACH item as 'Label: value': 'Sensitivity: 1-10; Readiness for round 2: ...; Physical aftermath: ...; Emotional aftermath: ...'. Separate by ; to render as pills!]",
   "SexRev": "[AFTERMATH ONLY: Full written review of the sex, like an Amazon review. End with a 5-star rating (e.g. Оценка: ★★★★☆). Write in full sentences. UPDATE REAL-TIME!]"
  }
 ]`;

    if (settings.enableUserBlock) {
      p += `,
 "user": {
  "A": "[{{user}}'s Age and Date of Birth (DD.MM.YYYY)]",
  "C": "[{{user}}'s CURRENT clothing/attire ONLY. UPDATE REAL-TIME!]",
  "Ap": "[{{user}}'s physical appearance ONLY. UPDATE REAL-TIME!]",
  "H": "[{{user}}'s health/physical state ONLY. UPDATE REAL-TIME!]",
  "Rel": "[{{user}}'s relationships with the other character(s) ONLY. Format EXACTLY as 'Name: relation'; Separate by ;]",
  "L": "[{{user}}'s exact current location ONLY. UPDATE REAL-TIME!]",
  "UW": "[DURING INTIMACY ONLY. EACH item as 'Label: value': 'Уровень возбуждения: ...; Уровень желания: ...; Готовность: ...; Лобок/Волосы: ...; Анатомия (вагина/клитор, чувствительность, заполненность и т.д.): ...; Смазка: ...; Грудь/Соски: ...; Громкость: ...; Следы: ...; Готовность ко 2 раунду: ...'. CLEAR TO 'empty' WHEN SCENE ENDS! Separate by ;]"
 }`;
    }

    if (settings.enableMemory) {
      p += `,
 "memory": {
  "timeline": ["[HH:MM] - [Event]", "MAX 5 RECENT EVENTS OF TODAY; KEEP CHRONOLOGICAL"],
  "mood": {
   "user": {"current": "[Current mood of {{user}} in the scene]", "history": ["[HH:MM] - [mood]"]},
   "char": {"current": "[Current mood of {{char}} in the scene]", "history": ["[HH:MM] - [mood]"]}
  },
  "route": {
   "user": ["[HH:MM] - [place] - [arrived/left/stayed/moved]"],
   "char": ["[HH:MM] - [place] - [arrived/left/stayed/moved]"]
  },
  "important": ["[Important fact / recently learned fact]"],
  "secrets": [
   {
    "fact": "[Secret fact]",
    "level": "low | medium | high | critical",
    "status": "unknown | suspected | partial | known",
    "knows": [{"name": "[Who knows]", "source": "[How/why they know]"}],
    "hidden": ["[Who does NOT know]"]
   }
  ]
  - SECRET LIFECYCLE: If a secret becomes revealed/known to everyone in the story, DELETE that secret object from future HUDs instead of marking it as active.
  - SECRET DISPLAY: Each knower MUST have a source explaining how they learned it. Use the level and dynamic status truthfully. Do not invent knowledge.
  - MAIN PROTAGONIST NAMES: The rendered Memory labels must use the real names of {{user}} and {{char}}, never "Вы", "User", "главный персонаж", "Char", or "главный персонаж".
  - ACTIVE SCENE MEMORY: If either protagonist is absent from the current scene, emit an empty object/array for that protagonist's mood and route; do not invent off-screen tracking.
 }`;
    }

    if (settings.enablePhone) {
      p += `,
  "chatsMap": {
   "[Contact Name OR Group Name]": {
    "owner": "[Owner of device]",
    "participants": "[OPTIONAL — include ONLY if this is a group chat; omit the field entirely for one-to-one chats]",
    "messages": [
     "[Sender] -> [Recipient]: [Message] | [Time] | [Read/Unread/Deleted/Draft]"
    ]
   }
  }`;
    }

    if (settings.enableIntercepts) {
      p += `,
 "intercepts": [
  {
   "target": "[NPC owner whose phone is intercepted]",
   "chatName": "[NPC-to-NPC or group chat name]",
   "participants": "[OPTIONAL — include ONLY for a group chat; omit the field entirely for one-to-one/private chats]",
   "messages": [
    "[REAL-TIME SECRET CONVERSATION] [Sender] -> [Recipient]: [Msg] | [Time] | [Read/Unread/Deleted/Draft]"
   ]
  }
 ]`;
    }

    if (settings.enableDiary) {
      p += `,
 "diary": [
  {
   "author": "[Character/NPC name — NEVER {{user}}]",
   "time": "[Date/Time]",
   "text": "[FIRST-PERSON PRIVATE DIARY ENTRY about the author's own day, physical state, emotions, thoughts, doubts, decisions and self-reflection. MINIMUM 4-7 SENTENCES. The author may talk to themselves and process the situation in their own voice. Never write as an omniscient narrator.]",
   "aboutUser": "[PRIVATE FIRST-PERSON SUB-ENTRY ABOUT {{user}} ONLY: what the author feels, thinks, wants, fears, notices, remembers or wonders about {{user}}. Write from the author's perspective, never as an external analysis. If the author has nothing meaningful to say about {{user}} this turn, use 'empty'.]"
  }
 ]`;
    }

    if (settings.enableDreams) {
      p += `,
 "dreams": [
  {
   "text": "[Vivid recent dream or nightmare - ONLY IF SLEEPING or UNCONSCIOUS. UPDATE REAL-TIME!]",
   "meaning": "[AI interpretation of the dream's hidden meaning]"
  }
 ]`;
    }

    if (settings.enableWorld) {
      p += `,
 "world": {
  "headlines": ["[Headline 1] | [Article text. UPDATE REAL-TIME!]", "[GENERATE N AMOUNT!]"],
  "rumors": ["[Rumor 1. UPDATE REAL-TIME!]", "[GENERATE N AMOUNT!]"],
  "ads": ["[Ad 1. UPDATE REAL-TIME!]", "[GENERATE N AMOUNT!]"]`;
      if (settings.showComments) {
        p += `,
  "comments": ["[User1: comment. UPDATE REAL-TIME!]", "[GENERATE N AMOUNT!]"]`;
      }
      p += `\n }`;
    }
     
    p += `\n}\n\`\`\`\n[/HUD]\n</system_note>`;

    if (settings.useCards && typeof window.characters !== 'undefined' && window.this_chid !== undefined) {
      const char = window.characters[window.this_chid];
      if (char && char.personality) p += `\n\nPlaying as ${char.name}.`;
    }
    return p;
  }

  function buildLightningSvg() {
    return `<svg viewBox="0 0 140 140" preserveAspectRatio="none" class="hud-bolt-svg">
      <path class="hud-bolt-path hud-bolt-main" d="M 78 4 L 62 46 L 76 50 L 48 96 L 58 60 L 44 56 Z"></path>
      <path class="hud-bolt-path hud-bolt-branch" d="M 68 40 L 84 50 L 74 56"></path>
    </svg>`;
  }

  function buildSeasonSceneHtml(seasonClass, extra) {
    extra = extra || {};
    if (seasonClass === 'season-autumn') {
      let birds = '';
      for (let i = 1; i <= 5; i++) birds += `<span class="hud-bird b${i}"></span>`;
      // Autumn background: one apple tree (bt2), two leaf-fall trees (bt1/bt4),
      // one plain tree (bt3). This keeps the scene varied without animating every tree.
      let backTrees = '';
      for (let i = 1; i <= 4; i++) {
        const apples = i === 2
          ? `<span class="hud-tree-apples"><span class="hud-tree-apple a1"></span><span class="hud-tree-apple a2"></span><span class="hud-tree-apple a3"></span></span>`
          : '';
        const fallingLeaves = (i === 1 || i === 4)
          ? `<span class="hud-tree-leaves"><span class="hud-tree-leaf lf1"></span><span class="hud-tree-leaf lf2"></span><span class="hud-tree-leaf lf3"></span></span>`
          : '';
        // Sparse autumn foliage: one lightweight CSS foliage layer per tree, not many DOM leaves.
        // The apple tree gets slightly denser foliage; leaf-fall trees remain visibly sparse.
        const foliage = `<span class="hud-bg-tree-autumn-foliage foliage-${i}" aria-hidden="true"></span>`;
        backTrees += `<span class="hud-bg-tree hud-bg-tree-autumn bt${i}"><span class="hud-bg-tree-trunk"></span><span class="hud-bg-tree-branch br1"></span><span class="hud-bg-tree-branch br2"></span><span class="hud-bg-tree-branch br3"></span>${foliage}${apples}${fallingLeaves}</span>`;
      }
      const fallenApples = `<div class="hud-fallen-apples"><span class="hud-fallen-apple fa1"></span><span class="hud-fallen-apple fa2"></span><span class="hud-fallen-apple fa3"></span><span class="hud-fallen-apple fa4"></span><span class="hud-fallen-apple fa5"></span></div>`;
      return `<div class="hud-ground hud-ground-autumn"></div><div class="hud-bg-trees">${backTrees}</div><div class="hud-bird-flock">${birds}</div>${fallenApples}<div class="hud-hedgehog"><span class="hud-hedgehog-apple ha1"></span><span class="hud-hedgehog-apple ha2"></span><span class="hud-hedgehog-body"></span><span class="hud-hedgehog-spikes"></span><span class="hud-hedgehog-face"></span></div><div class="hud-burrow"><span class="hud-burrow-mound"></span><span class="hud-burrow-hole"></span><span class="hud-burrow-animal"><span class="hud-burrow-animal-body"></span><span class="hud-burrow-animal-spines"></span><span class="hud-burrow-animal-face"></span></span></div><div class="hud-campfire"><span class="hud-campfire-log"></span><span class="hud-campfire-flame f1"></span><span class="hud-campfire-flame f2"></span><span class="hud-campfire-smoke s1"></span><span class="hud-campfire-smoke s2"></span><span class="hud-campfire-smoke s3"></span></div>`;
    }
    if (seasonClass === 'season-spring') {
      let flowers = '';
      for (let i = 1; i <= 5; i++) {
        flowers += `<span class="hud-flower f${i}"><span class="hud-flower-stem"></span><span class="hud-flower-head"><span class="hud-petal p1"></span><span class="hud-petal p2"></span><span class="hud-petal p3"></span><span class="hud-petal p4"></span><span class="hud-flower-center"></span></span></span>`;
      }
      let pollen = '';
      for (let i = 1; i <= 4; i++) pollen += `<span class="hud-pollen d${i}"></span>`;
      let dew = extra.dew ? `<span class="hud-dew dw1"></span><span class="hud-dew dw2"></span><span class="hud-dew dw3"></span><span class="hud-dew dw4"></span>` : '';
      let backTrees = '';
      for (let i = 1; i <= 4; i++) {
        const nest = i === 2
          ? `<span class="hud-bg-nest"><span class="hud-bg-chick c1"></span><span class="hud-bg-chick c2"></span></span>`
          : '';
        backTrees += `<span class="hud-bg-tree hud-bg-tree-spring bt${i}"><span class="hud-bg-tree-trunk"></span><span class="hud-bg-tree-branch br1"></span><span class="hud-bg-tree-branch br2"></span><span class="hud-bg-tree-branch br3"></span><span class="hud-bg-tree-canopy"></span>${nest}</span>`;
      }
      return `<div class="hud-meadow"></div><div class="hud-bg-trees">${backTrees}</div><div class="hud-flowerbed">${flowers}</div>${pollen}${dew}<div class="hud-butterfly"><span class="hud-butterfly-wing w-left"></span><span class="hud-butterfly-wing w-right"></span></div><div class="hud-bee bee1"><span class="hud-bee-wing"></span></div><div class="hud-bee bee2"><span class="hud-bee-wing"></span></div>`;
    }
    if (seasonClass === 'season-summer') {
      let teeth = '';
      for (let i = 1; i <= 6; i++) teeth += `<span class="hud-umbrella-tooth"></span>`;
      return `<div class="hud-summer-horizon"></div><div class="hud-summer-distant-island"></div><div class="hud-sand"></div><div class="hud-sailboat"><span class="hud-sailboat-hull"></span><span class="hud-sailboat-sail"></span></div><div class="hud-gull g1"></div><div class="hud-gull g2"></div><div class="hud-sea"><span class="hud-wave w1"></span><span class="hud-wave w2"></span></div><div class="hud-summer-heat-haze"></div><div class="hud-sandcastle"><span class="hud-sandcastle-base"></span><span class="hud-sandcastle-tower t1"></span><span class="hud-sandcastle-tower t2"></span><span class="hud-sandcastle-tower t3"></span><span class="hud-sandcastle-turret tr1"></span><span class="hud-sandcastle-turret tr2"></span><span class="hud-sandcastle-turret tr3"></span><span class="hud-sandcastle-flag"></span><span class="hud-sandcastle-shovel"></span></div><div class="hud-volleyball-net"><span class="hud-net-post post-left"></span><span class="hud-net-post post-right"></span><span class="hud-net-band"></span><span class="hud-net-mesh"></span></div><div class="hud-volleyball"><span class="hud-volleyball-seam s1"></span><span class="hud-volleyball-seam s2"></span></div><div class="hud-summer-dragonfly"><span class="hud-dragonfly-head"></span><span class="hud-dragonfly-body"><i></i><i></i><i></i></span><span class="hud-dragonfly-wing wing1"></span><span class="hud-dragonfly-wing wing2"></span><span class="hud-dragonfly-wing wing3"></span><span class="hud-dragonfly-wing wing4"></span></div><div class="hud-summer-cicada-sound c1"></div><div class="hud-summer-cicada-sound c2"></div><div class="hud-towel-shadow"></div><div class="hud-towel"></div><div class="hud-umbrella"><span class="hud-umbrella-canopy"></span><span class="hud-umbrella-valance">${teeth}</span><span class="hud-umbrella-pole"></span></div>`;
    }
    if (seasonClass === 'season-winter') {
      let icicles = '';
      for (let i = 1; i <= 8; i++) icicles += `<span class="hud-icicle ic${i}"></span>`;
      let sparkle = extra.deepFreeze ? (() => { let s=''; for (let i=1;i<=6;i++) s += `<span class="hud-sparkle sp${i}"></span>`; return s; })() : '';
      let backTrees = ''; for (let i = 1; i <= 4; i++) backTrees += `<span class="hud-bg-tree hud-bg-tree-winter bt${i}"><span class="hud-bg-tree-trunk"></span><span class="hud-bg-tree-branch br1"></span><span class="hud-bg-tree-branch br2"></span><span class="hud-bg-tree-branch br3"></span><span class="hud-bg-tree-snow s1"></span><span class="hud-bg-tree-snow s2"></span><span class="hud-bg-tree-snow s3"></span></span>`;
      return `<div class="hud-winter-distant-forest"></div><div class="hud-winter-aurora"></div><div class="hud-winter-house"><span class="hud-winter-house-body"></span><span class="hud-winter-house-roof"></span><span class="hud-winter-house-door"></span><span class="hud-winter-warm-window"><span class="hud-window-pane p1"></span><span class="hud-window-pane p2"></span></span><span class="hud-winter-chimney"><span class="hud-winter-smoke sm1"></span><span class="hud-winter-smoke sm2"></span><span class="hud-winter-smoke sm3"></span></span></div><div class="hud-winter-animal-trail"><span class="hud-animal-print ap1"></span><span class="hud-animal-print ap2"></span><span class="hud-animal-print ap3"></span><span class="hud-animal-print ap4"></span></div><div class="hud-winter-branch-snow bs1"></div><div class="hud-winter-branch-snow bs2"></div><div class="hud-icicle-row">${icicles}</div><div class="hud-ground hud-ground-snow"></div><div class="hud-winter-frozen-pond"><span class="hud-ice-crack cr1"></span><span class="hud-ice-crack cr2"></span><span class="hud-ice-crack cr3"></span><span class="hud-ice-crack cr4"></span></div><div class="hud-bg-trees">${backTrees}</div>${sparkle}<div class="hud-snowman"><span class="hud-snowman-shadow"></span><span class="hud-snowman-arm arm-left"></span><span class="hud-snowman-arm arm-right"></span><span class="hud-snowman-ball ball-bottom"></span><span class="hud-snowman-ball ball-mid"></span><span class="hud-snowman-button btn1"></span><span class="hud-snowman-button btn2"></span><span class="hud-snowman-button btn3"></span><span class="hud-snowman-ball ball-head"></span><span class="hud-snowman-eye eye-left"></span><span class="hud-snowman-eye eye-right"></span><span class="hud-snowman-carrot"></span><span class="hud-snowman-mouth"><span class="hud-snowman-pebble p1"></span><span class="hud-snowman-pebble p2"></span><span class="hud-snowman-pebble p3"></span><span class="hud-snowman-pebble p4"></span><span class="hud-snowman-pebble p5"></span></span><span class="hud-snowman-hat-brim"></span><span class="hud-snowman-hat-top"></span></div>`;
    }
    return '';
  }

  function mapKey(k) {
    const raw = String(k ?? '').trim();
    const n = raw.toLowerCase().replace(/[ё]/g, 'е').replace(/[\s_-]+/g, ' ');
    const map = {
      't':'Время','время':'Время','time':'Время',
      'wth':'Погода','погода':'Погода','weather':'Погода',
      'dt':'Дата','дата':'Дата','date':'Дата',
      'atm':'Атмосфера','атмосфера':'Атмосфера','atmosphere':'Атмосфера',
      'md':'Настроение','настроение':'Настроение','mood':'Настроение',
      'n':'Имя','имя':'Имя','name':'Имя',
      'a':'Возраст','возраст':'Возраст','age':'Возраст',
      'c':'Одежда','одежда':'Одежда','clothing':'Одежда','outfit':'Одежда',
      'ap':'Внешность','внешность':'Внешность','appearance':'Внешность',
      'h':'Здоровье','здоровье':'Здоровье','health':'Здоровье',
      'r':'Роль','роль':'Роль','role':'Роль',
      'b':'Тело','тело':'Тело','body':'Тело',
      'ph':'Физиология','физиология':'Физиология','physiology':'Физиология',
      'l':'Место','место':'Место','location':'Место','place':'Место',
      'th':'Мысли','мысли':'Мысли','thoughts':'Мысли','thought':'Мысли',
      'k':'Ключ','ключ':'Ключ','key':'Ключ',
      'exp':'Ожидание vs Реальность','ожидание vs реальность':'Ожидание vs Реальность','expectation vs reality':'Ожидание vs Реальность','expectation':'Ожидание vs Реальность',
      'd':'Скрытый подтекст','скрытый подтекст':'Скрытый подтекст','subtext':'Скрытый подтекст','hidden subtext':'Скрытый подтекст',
      'i':'Инвентарь','инвентарь':'Инвентарь','inventory':'Инвентарь',
      'g':'Цели','цели':'Цели','goals':'Цели','goal':'Цели',
      's':'Расписание','расписание':'Расписание','schedule':'Расписание',
      'rel':'Отношения','отношения':'Отношения','relationships':'Отношения','relationship':'Отношения',
      'mem':'Общие воспоминания','общие воспоминания':'Общие воспоминания','memories':'Общие воспоминания','shared memories':'Общие воспоминания',
      'flag':'Флаг-монитор','флаг-монитор':'Флаг-монитор','flag-monitor':'Флаг-монитор','flags':'Флаг-монитор',
      'st':'Статус','статус':'Статус','status':'Статус',
      'exo':'Социальное разоблачение','социальное разоблачение':'Социальное разоблачение','social exposure':'Социальное разоблачение',
      'x':'Глубина конфликта','глубина конфликта':'Глубина конфликта','conflict depth':'Глубина конфликта','conflict':'Глубина конфликта',
      'sexlast':'Последний секс','последний секс':'Последний секс','last sex':'Последний секс',
      'sexcount':'Количество партнеров','количество партнеров':'Количество партнеров','partner count':'Количество партнеров','sex count':'Количество партнеров',
      'sexreg':'Регулярность секса','регулярность секса':'Регулярность секса','sex regularity':'Регулярность секса',
      'nsfw det':'Детализация NSFW','nsfw_det':'Детализация NSFW','детализация nsfw':'Детализация NSFW','nsfw details':'Детализация NSFW',
      'sexrev':'Отзыв о сексе','отзыв о сексе':'Отзыв о сексе','sex review':'Отзыв о сексе',
      'w':'NSFW','nsfw':'NSFW',
      'dr':'Сновидение','сновидение':'Сновидение','dream':'Сновидение','dreams':'Сновидение',
      'uw':'NSFW (Юзер)','nsfw (юзер)':'NSFW (Юзер)','nsfw (user)':'NSFW (Юзер)','user nsfw':'NSFW (Юзер)'
    };
    return map[n] || raw;
  }

  const FULL_WIDTH_KEYS = ['мысли', 'ключ', 'ожидание vs реальность', 'отношения', 'общие воспоминания', 'флаг-монитор', 'социальное разоблачение', 'детализация nsfw', 'отзыв о сексе', 'nsfw', 'сновидение', 'расписание', 'скрытый подтекст', 'последний секс'];
  const DRAMA_KEYS = ['ревность', 'конфликт', 'глубина конфликта'];
  const TRUNCATE_KEYS = ['мысли', 'физиология'];

  if (!window.__tavernOSFetchPatched) {
      window.__tavernOSFetchPatched = true;

      const originalFetch = window.fetch;
      window.fetch = async function(resource, options) {
    if (settings.autoInject && options && options.method === 'POST' && options.body && typeof options.body === 'string') {
      const urlStr = typeof resource === 'string' ? resource : (resource instanceof Request ? resource.url : '');
      const isImageRequest = /image|sdapi|draw|vision|dall-e/i.test(urlStr);
      if (window.__tavernOSHudRegenRequest === true) return originalFetch.apply(window, arguments);

      // Достоверная проверка типа генерации: если interceptor успел сообщить нам, что это
      // 'quiet' (саммари/автоперевод/фоновая генерация) или 'impersonate' (генерация ЗА юзера),
      // не трогаем запрос вообще — пусть уходит как есть, без наших HUD-инструкций.
      // lastGenType === null означает "interceptor ещё не отработал в этой сессии" (например,
      // очень старый клиент SillyTavern без поддержки generate_interceptor) — в этом случае
      // не блокируем, чтобы не сломать инъекцию на старых версиях (fail-open).
      const isHudGenerationEndpoint = !isImageRequest && urlStr.includes('/api/') && (urlStr.includes('generate') || urlStr.includes('completions') || urlStr.includes('chat'));
      // Correlate the official generate_interceptor entry only with an actual text-generation
      // request. Other POSTs (settings, lorebooks, avatars, etc.) must never consume a queued
      // generation type, otherwise a quiet/impersonate classification can leak into the next chat.
      let effectiveGenType = null;
      if (isHudGenerationEndpoint) {
        const now = Date.now();
        while (pendingGenTypes.length && now - pendingGenTypes[0].at > 10000) pendingGenTypes.shift();
        const queued = pendingGenTypes.length ? pendingGenTypes.shift() : null;
        effectiveGenType = queued ? queued.type : lastGenType;
        lastGenType = pendingGenTypes.length ? pendingGenTypes[pendingGenTypes.length - 1].type : null;
      }
      const isBlockedGenType = effectiveGenType !== null && HUD_BLOCKED_GEN_TYPES.includes(effectiveGenType);

      if (isHudGenerationEndpoint && !isBlockedGenType) {
        try {
          let parsedBody = JSON.parse(options.body);
          let modified = false;

          const hasImageParams = parsedBody.negative_prompt !== undefined || parsedBody.width !== undefined || parsedBody.height !== undefined || parsedBody.size !== undefined || parsedBody.steps !== undefined || parsedBody.sampler_name !== undefined;
          const hasTextParams = parsedBody.messages !== undefined || parsedBody.max_tokens !== undefined || parsedBody.max_new_tokens !== undefined || parsedBody.temperature !== undefined;

          // ВОЗВРАЩАЕМ ЗАЩИТУ ОТ ИНЖЕКТА В КАРТИНКИ
          if (hasImageParams || !hasTextParams) return originalFetch.apply(window, arguments);

          let hudsToKeep = parseInt(settings.hudsToKeep, 10);
          if (isNaN(hudsToKeep) || hudsToKeep < 0) hudsToKeep = 2;

          // Единая функция для сборки текста саммари (добавлен Возраст)
          const buildSummaryText = (hudText) => {
              let parsedObj = parseHUDComplex(hudText);
              let summaryStr = `[HUD_SUMMARY] `;
              
              if (parsedObj.scene && parsedObj.scene['Дата']) summaryStr += `Дата: ${parsedObj.scene['Дата']}. `;
              if (parsedObj.scene && parsedObj.scene['Время']) summaryStr += `Время: ${parsedObj.scene['Время']}. `;
              if (parsedObj.scene && parsedObj.scene['Погода']) summaryStr += `Погода: ${parsedObj.scene['Погода']}. `;
              
              let cSums = [];
              if (parsedObj.characters) {
                  parsedObj.characters.forEach(c => {
                      if (c['Имя']) {
                          let details = [];
                          if (c['Возраст'] && String(c['Возраст']).toLowerCase() !== 'empty' && String(c['Возраст']).toLowerCase() !== 'none') details.push(`Возраст: ${c['Возраст']}`);
                          if (c['Место'] && String(c['Место']).toLowerCase() !== 'empty' && String(c['Место']).toLowerCase() !== 'none') details.push(`Место: ${c['Место']}`);
                          cSums.push(details.length > 0 ? `${c['Имя']} (${details.join(', ')})` : c['Имя']);
                      }
                  });
              }
              if (parsedObj.user) {
                  let uDetails = [];
                  if (parsedObj.user['Возраст'] && String(parsedObj.user['Возраст']).toLowerCase() !== 'empty' && String(parsedObj.user['Возраст']).toLowerCase() !== 'none') uDetails.push(`Возраст: ${parsedObj.user['Возраст']}`);
                  if (parsedObj.user['Место'] && String(parsedObj.user['Место']).toLowerCase() !== 'empty' && String(parsedObj.user['Место']).toLowerCase() !== 'none') uDetails.push(`Место: ${parsedObj.user['Место']}`);
                  if (uDetails.length > 0) cSums.push(`User (${uDetails.join(', ')})`);
                  else if (Object.keys(parsedObj.user).length > 0) cSums.push(`User`);
              }
              if (cSums.length > 0) summaryStr += cSums.join('; ') + ` `;
              
              return summaryStr + `[/HUD_SUMMARY]`;
          };

          // 1. Формат Chat Completions (учитываем массив messages)
          if (parsedBody.messages && Array.isArray(parsedBody.messages)) {
            let allMatches = [];
            parsedBody.messages.forEach((msg, mIdx) => {
              if (typeof msg.content === 'string') {
                // ВАЖНО: Регулярка объявляется ВНУТРИ цикла, чтобы ее lastIndex сбрасывался для каждого сообщения
                const regexLocal = /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)([\s\S]*?)(?:(?:\[|&lt;|<|&#91;)\s*(?:\/|&#47;|\\)\s*HUD\s*(?:\]|&gt;|>|&#93;)|$)/ig;
                let match;
                while ((match = regexLocal.exec(msg.content)) !== null) {
                  allMatches.push({ mIdx, index: match.index, length: match[0].length });
                }
              }
            });

            if (allMatches.length > hudsToKeep) {
              let toSummarize = allMatches.slice(0, allMatches.length - hudsToKeep);
              toSummarize.sort((a, b) => (a.mIdx !== b.mIdx ? b.mIdx - a.mIdx : b.index - a.index));
              
              toSummarize.forEach(rm => {
                let content = parsedBody.messages[rm.mIdx].content;
                let hudBlockText = content.substring(rm.index, rm.index + rm.length);
                
                parsedBody.messages[rm.mIdx].content = content.slice(0, rm.index) + '\n' + buildSummaryText(hudBlockText) + '\n' + content.slice(rm.index + rm.length);
                modified = true;
              });
            }
          } 
          // 2. Формат Text Completions (учитываем единую строку prompt)
          else if (parsedBody.prompt && typeof parsedBody.prompt === 'string') {
            let allMatches = [];
            const regexLocal = /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)([\s\S]*?)(?:(?:\[|&lt;|<|&#91;)\s*(?:\/|&#47;|\\)\s*HUD\s*(?:\]|&gt;|>|&#93;)|$)/ig;
            let match;
            while ((match = regexLocal.exec(parsedBody.prompt)) !== null) {
              allMatches.push({ index: match.index, length: match[0].length });
            }
            if (allMatches.length > hudsToKeep) {
              let toSummarize = allMatches.slice(0, allMatches.length - hudsToKeep);
              toSummarize.sort((a, b) => b.index - a.index);
              
              toSummarize.forEach(rm => {
                let content = parsedBody.prompt;
                let hudBlockText = content.substring(rm.index, rm.index + rm.length);
                
                parsedBody.prompt = content.slice(0, rm.index) + '\n' + buildSummaryText(hudBlockText) + '\n' + content.slice(rm.index + rm.length);
                modified = true;
              });
            }
          }

          // Добавляем HUD-инструкцию, НЕ переписывая существующее assistant/model-сообщение.
          // Это особенно важно для Swipe/Regen: у DeepSeek и некоторых OpenAI-compatible
          // backend последний message может быть assistant/model. Раньше мы дописывали
          // dynamicPrompt прямо туда, из-за чего штатный swipe-запрос превращался в
          // provider-invalid payload. Для assistant/model создаём отдельное user-сообщение.
          let dynamicPrompt = buildDynamicPrompt();
          if (parsedBody.messages && Array.isArray(parsedBody.messages) && parsedBody.messages.length > 0) {
            const lastMsgIndex = parsedBody.messages.length - 1;
            const lastMsg = parsedBody.messages[lastMsgIndex];
            const lastRole = String(lastMsg?.role || '').toLowerCase();
            if (lastRole === 'assistant' || lastRole === 'model') {
              parsedBody.messages.push({ role: lastRole === 'model' ? 'user' : 'user', content: dynamicPrompt });
            } else if (typeof lastMsg.content === 'string') {
              lastMsg.content += dynamicPrompt;
            } else {
              parsedBody.messages.push({ role: 'user', content: dynamicPrompt });
            }
            modified = true;
          } else if (parsedBody.prompt && typeof parsedBody.prompt === 'string') {
            parsedBody.prompt += dynamicPrompt;
            modified = true;
          }
          
          if (modified) {
            options.body = JSON.stringify(parsedBody);
          }

          // Для «Создать HUD» нужен шаблон последнего запроса даже если
          // TavernOS не менял исходный запрос.
          if (hasTextParams) {
            let headersCopy = {};
            if (options.headers) {
              if (typeof options.headers.forEach === 'function') {
                options.headers.forEach((v, k) => { headersCopy[k] = v; });
              } else { headersCopy = JSON.parse(JSON.stringify(options.headers)); }
            }
            window.lastTavernRequest = { url: urlStr, headers: headersCopy, body: JSON.parse(JSON.stringify(parsedBody)) };
            persistLastTavernRequest(window.lastTavernRequest);
          }
        } catch (e) { console.error("HUD API Error", e); }
      }
    }
    return originalFetch.apply(window, arguments);
  };
  } // <--- ВОТ ЭТА СКОБКА СПАСЕТ НАМ ЖИЗНЬ (закрывает if)

  function hexToRgba(hex, alpha) {
      alpha = alpha === undefined ? 100 : Number(alpha);
      if (isNaN(alpha)) alpha = 100;
      if (typeof hex !== 'string' || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) hex = '#000000';
      let c = hex.substring(1).split('');
      if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
      c = '0x' + c.join(''); return `rgba(${[(c>>16)&255, (c>>8)&255, c&255].join(', ')}, ${alpha / 100})`;
  }

 function applyThemeColors() {
    const root = document.documentElement;
    if (settings.accentColor) root.style.setProperty('--hud-accent', settings.accentColor);
    if (settings.glowColor) root.style.setProperty('--hud-purple-glow', hexToRgba(settings.glowColor, settings.glowAlpha !== undefined ? settings.glowAlpha : 40)); 
    
    if (settings.cardBgStart && settings.cardBgEnd) root.style.setProperty('--hud-bg', `linear-gradient(135deg, ${hexToRgba(settings.cardBgStart, settings.cardBgAlpha)}, ${hexToRgba(settings.cardBgEnd, settings.cardBgAlpha)})`);
    if (settings.infoBlockBgStart && settings.infoBlockBgEnd) root.style.setProperty('--hud-card-inner-bg', `linear-gradient(135deg, ${hexToRgba(settings.infoBlockBgStart, settings.infoBlockBgAlpha)}, ${hexToRgba(settings.infoBlockBgEnd, settings.infoBlockBgAlpha)})`);
    if (settings.topBarBg) root.style.setProperty('--hud-header-bg', hexToRgba(settings.topBarBg, settings.topBarAlpha));
    if (settings.tabsBg) root.style.setProperty('--hud-tab-bg', hexToRgba(settings.tabsBg, settings.tabsAlpha));
    
    if (settings.sceneOverlayColor) root.style.setProperty('--hud-scene-overlay', hexToRgba(settings.sceneOverlayColor, settings.sceneOverlayAlpha));
    if (settings.sceneTextColor) root.style.setProperty('--hud-scene-text', settings.sceneTextColor);
    
    // Новые настройки погоды
    if (settings.weatherBgColor) root.style.setProperty('--hud-weather-bg', hexToRgba(settings.weatherBgColor, settings.weatherBgAlpha !== undefined ? settings.weatherBgAlpha : 40));
    if (settings.weatherBlur !== undefined) root.style.setProperty('--hud-weather-blur', settings.weatherBlur + 'px');

    if (settings.nsfwColor) {
        root.style.setProperty('--hud-nsfw-border', settings.nsfwColor);
        root.style.setProperty('--hud-nsfw-bg', hexToRgba(settings.nsfwColor, settings.nsfwBgAlpha !== undefined ? settings.nsfwBgAlpha : 20));
    }
    if (settings.dramaColor) {
        root.style.setProperty('--hud-drama-border', settings.dramaColor);
        root.style.setProperty('--hud-drama-bg', hexToRgba(settings.dramaColor, settings.dramaBgAlpha !== undefined ? settings.dramaBgAlpha : 15));
    }
    if (settings.interceptColor) {
        root.style.setProperty('--hud-intercept-color', settings.interceptColor);
        root.style.setProperty('--hud-intercept-bg', hexToRgba(settings.interceptColor, settings.interceptBgAlpha !== undefined ? settings.interceptBgAlpha : 15));
    }
    if (settings.memoryBgStart && settings.memoryBgEnd) root.style.setProperty('--hud-memory-bg', `linear-gradient(135deg, ${hexToRgba(settings.memoryBgStart, settings.memoryBgAlpha)}, ${hexToRgba(settings.memoryBgEnd, settings.memoryBgAlpha)})`);
    if (settings.memoryAccent) root.style.setProperty('--hud-memory-accent', settings.memoryAccent);
    if (settings.memoryGlowAlpha !== undefined) root.style.setProperty('--hud-memory-glow', hexToRgba(settings.memoryAccent || '#8c5ad2', settings.memoryGlowAlpha));
    if (settings.memoryBlur !== undefined) root.style.setProperty('--hud-memory-blur', settings.memoryBlur + 'px');
    if (settings.memoryMaxHeight !== undefined) root.style.setProperty('--hud-memory-max-height', Math.max(200, Number(settings.memoryMaxHeight) || 300) + 'px');
    if (settings.msgInBg) root.style.setProperty('--hud-msg-in', hexToRgba(settings.msgInBg, settings.msgInAlpha !== undefined ? settings.msgInAlpha : 15));
    if (settings.msgOutStart && settings.msgOutEnd) {
        root.style.setProperty('--hud-msg-out-start', settings.msgOutStart);
        root.style.setProperty('--hud-msg-out-end', hexToRgba(settings.msgOutEnd, settings.msgOutAlpha !== undefined ? settings.msgOutAlpha : 80));
    }
    if (settings.badgeColor) root.style.setProperty('--hud-badge-bg', settings.badgeColor);
    if (settings.clockColor) root.style.setProperty('--hud-clock-color', settings.clockColor);
    
    if (settings.fontSizeMain) root.style.setProperty('--hud-font-size-main', settings.fontSizeMain + 'px');
    if (settings.fontSizeHeaders) root.style.setProperty('--hud-font-size-headers', settings.fontSizeHeaders + 'px');
    if (settings.fontSizeClock) root.style.setProperty('--hud-font-size-clock', settings.fontSizeClock + 'px');
    if (settings.fontSizeDiary !== undefined) root.style.setProperty('--hud-font-size-diary', settings.fontSizeDiary + 'px'); // Размер дневника
    
    if (settings.fontMain) root.style.setProperty('--hud-font-main', settings.fontMain);
    if (settings.fontHeaders) root.style.setProperty('--hud-font-headers', settings.fontHeaders);
    if (settings.fontClock) root.style.setProperty('--hud-font-clock', settings.fontClock);
    if (settings.fontDiary) root.style.setProperty('--hud-font-diary', settings.fontDiary);

    if (settings.backdropBlur !== undefined) root.style.setProperty('--hud-blur-intensity', settings.backdropBlur + 'px');
    if (settings.bgImage && settings.bgImage.trim() !== '') {
        root.style.setProperty('--hud-custom-bg', `url("${settings.bgImage.trim()}")`);
    } else {
        root.style.setProperty('--hud-custom-bg', 'none');
    }
    if (settings.bgScale !== undefined) root.style.setProperty('--hud-bg-scale', settings.bgScale + '%');
    if (settings.bgOffsetY !== undefined) root.style.setProperty('--hud-bg-y', settings.bgOffsetY + '%');
    if (settings.bgOpacity !== undefined) root.style.setProperty('--hud-bg-opacity', settings.bgOpacity / 100);
  }

  function loadSettings() { 
    const saved = localStorage.getItem('hud_settings'); 
    if (saved) { try { settings = Object.assign(settings, JSON.parse(saved)); } catch (e) {} } 
    applyThemeColors(); 
  }
  function saveSettings() {
    try {
      localStorage.setItem('hud_settings', JSON.stringify(settings));
    } catch (e) {
      console.error('HUD: не удалось сохранить настройки', e);
      showHudToast('error', 'Настройки не сохранены', 'localStorage недоступен (приватный режим / нет места): ' + e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // HUD EXTERNAL CONTEXT: selected Lorebooks + character card + Persona.
  // Used ONLY by the explicit HUD create/regenerate path. The normal network
  // injection/buildDynamicPrompt path is intentionally untouched.
  // ---------------------------------------------------------------------------
  function getStContextSafe() {
    try {
      if (window.SillyTavern && typeof window.SillyTavern.getContext === 'function') return window.SillyTavern.getContext();
      if (typeof getContext === 'function') return getContext();
      if (typeof window.getContext === 'function') return window.getContext();
    } catch (_) {}
    return null;
  }

  function getMainProtagonistNames(stContext = null) {
    let ctx = stContext;
    if (!ctx) { try { ctx = getStContextSafe(); } catch (_) {} }
    const userName = String(ctx?.name1 || window.name1 || ctx?.userName || '').trim();
    const charName = String(ctx?.name2 || window.name2 || ctx?.charName || '').trim();
    return {
      user: userName && !/^\{\{user\}\}$/i.test(userName) ? userName : 'Player',
      char: charName && !/^\{\{char\}\}$/i.test(charName) ? charName : 'Character'
    };
  }

  function getStRequestHeadersSafe() {
    try {
      const stContext = getStContextSafe();
      if (stContext && typeof stContext.getRequestHeaders === 'function') {
        const headers = stContext.getRequestHeaders();
        if (headers && typeof headers === 'object') return headers;
      }
    } catch (_) {}
    try { if (typeof getRequestHeaders === 'function') return getRequestHeaders(); } catch (_) {}
    return { 'Content-Type': 'application/json' };
  }

  async function getAvailableHudLorebooks() {
    try {
      const stContext = getStContextSafe();
      if (stContext && typeof stContext.getWorldInfoNames === 'function') {
        const names = await stContext.getWorldInfoNames();
        if (Array.isArray(names)) return names.filter(Boolean);
      }
    } catch (e) { console.debug('[TavernOS HUD] getWorldInfoNames() недоступен:', e); }
    try { if (Array.isArray(window.world_names)) return window.world_names.filter(Boolean); } catch (_) {}
    for (const url of ['/api/worldinfo/list', '/api/settings/get', '/getsettings']) {
      try {
        const response = await fetch(url, { method:'POST', headers:getStRequestHeadersSafe(), body:JSON.stringify({}), cache:'no-cache' });
        if (!response.ok) continue;
        const data = await response.json();
        const names = Array.isArray(data.world_names) ? data.world_names
          : Array.isArray(data.worlds) ? data.worlds
          : Array.isArray(data) ? data : [];
        if (Array.isArray(names)) return names.map(x => typeof x === 'string' ? x : (x?.name || x?.filename)).filter(Boolean);
      } catch (_) {}
    }
    console.warn('[TavernOS HUD] Не удалось получить список Lorebooks.');
    return [];
  }

  async function loadHudLorebook(name) {
    if (!name) return null;
    try {
      const response = await fetch('/api/worldinfo/get', { method:'POST', headers:getStRequestHeadersSafe(), body:JSON.stringify({name}), cache:'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (e) {
      try {
        const legacy = await fetch('/getworldinfo', { method:'POST', headers:getStRequestHeadersSafe(), body:JSON.stringify({name}), cache:'no-cache' });
        if (legacy.ok) return await legacy.json();
      } catch (_) {}
      console.warn(`[TavernOS HUD] Не удалось загрузить Lorebook "${name}":`, e);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // HUD Lorebook activation: mirror SillyTavern World Info's key mechanics for
  // the explicitly selected books. Constant entries are always included;
  // keyed entries are activated against the same conversation context.
  // ---------------------------------------------------------------------------
  function substituteHudLoreMacros(value, stContext) {
    const text = String(value ?? '');
    const protagonistNames = getMainProtagonistNames(stContext);
    const userName = protagonistNames.user;
    const charName = protagonistNames.char;
    return text
      .replace(/\{\{\s*user\s*\}\}/gi, userName)
      .replace(/\{\{\s*char\s*\}\}/gi, charName);
  }

  function hudLoreKeyMatches(text, key, entry, stContext) {
    const substituted = substituteHudLoreMacros(key, stContext).trim();
    if (!substituted) return false;

    const caseSensitive = entry?.extensions?.case_sensitive ?? entry?.caseSensitive;
    const wholeWords = entry?.extensions?.match_whole_words ?? entry?.matchWholeWords;
    const flags = caseSensitive ? 'g' : 'gi';

    // ST treats WI keys as regular expressions. Keep that behavior, with a
    // safe fallback to literal matching if a malformed regex is encountered.
    try {
      let pattern = substituted;
      if (wholeWords) pattern = `(?<!\\w)(?:${pattern})(?!\\w)`;
      return new RegExp(pattern, flags).test(text);
    } catch (_) {
      const hay = caseSensitive ? text : text.toLowerCase();
      const needle = caseSensitive ? substituted : substituted.toLowerCase();
      return wholeWords
        ? new RegExp(`(?<!\\w)${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\w)`, caseSensitive ? '' : 'i').test(text)
        : hay.includes(needle);
    }
  }

  function hudLoreEntryActivates(entry, scanText, stContext) {
    if (!entry || typeof entry !== 'object') return false;
    if (entry.disable === true || entry.disabled === true || entry.enabled === false) return false;

    const isConstant = entry.constant === true || entry.alwaysActive === true;
    if (isConstant) return true;

    const primary = Array.isArray(entry.key) ? entry.key.filter(Boolean) :
      Array.isArray(entry.keys) ? entry.keys.filter(Boolean) :
      typeof entry.key === 'string' ? entry.key.split(',').map(x => x.trim()).filter(Boolean) :
      typeof entry.keys === 'string' ? entry.keys.split(',').map(x => x.trim()).filter(Boolean) : [];
    if (!primary.length) return false;

    const primaryMatch = primary.some(key => hudLoreKeyMatches(scanText, key, entry, stContext));
    if (!primaryMatch) return false;

    const secondary = Array.isArray(entry.keysecondary) ? entry.keysecondary.filter(Boolean) :
      Array.isArray(entry.secondary_keys) ? entry.secondary_keys.filter(Boolean) :
      typeof entry.keysecondary === 'string' ? entry.keysecondary.split(',').map(x => x.trim()).filter(Boolean) :
      typeof entry.secondary_keys === 'string' ? entry.secondary_keys.split(',').map(x => x.trim()).filter(Boolean) : [];

    let logicActivated = true;
    // Modern ST entries are selective by default. If there are no secondary
    // keys, a primary-key hit is sufficient.
    if (secondary.length && (entry.selective !== false)) {
      const matches = secondary.map(key => hudLoreKeyMatches(scanText, key, entry, stContext));
      const any = matches.some(Boolean);
      const all = matches.every(Boolean);
      const logic = Number(entry.selectiveLogic ?? entry.extensions?.selectiveLogic ?? 0);
      // ST world_info_logic: AND_ANY=0, NOT_ALL=1, NOT_ANY=2, AND_ALL=3.
      if (logic === 1) logicActivated = !all;
      else if (logic === 2) logicActivated = !any;
      else if (logic === 3) logicActivated = all;
      else logicActivated = any;
    }
    if (!logicActivated) return false;

    // Respect the same probability gate used by World Info entries.
    const useProbability = entry.useProbability ?? entry.extensions?.useProbability ?? true;
    const probability = Number(entry.probability ?? entry.extensions?.probability ?? 100);
    if (useProbability && Number.isFinite(probability) && probability < 100) {
      if (Math.random() * 100 >= Math.max(0, probability)) return false;
    }
    return true;
  }

  function normalizeHudLoreEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    if (entry.disable === true || entry.disabled === true || entry.enabled === false) return null;
    const content = typeof entry.content === 'string' ? entry.content.trim() : '';
    return content || null;
  }

  async function buildHudLoreContext(scanText = '') {
    const selected = Array.isArray(settings.hudLorebooks) ? settings.hudLorebooks.filter(Boolean) : [];
    const stContext = getStContextSafe();
    const sections = [];
    try {
      const characterId = stContext?.characterId;
      const character = characterId !== undefined && characterId !== null && characterId >= 0 ? stContext?.characters?.[characterId] : null;
      const charData = character?.data || character || {};
      const charName = character?.name || charData?.name || window.name2 || '{{char}}';
      const description = charData?.description || character?.description || '';
      const personality = charData?.personality || character?.personality || '';
      const scenario = charData?.scenario || character?.scenario || '';
      if (String(description).trim() || String(personality).trim() || String(scenario).trim()) {
        sections.push(`CHARACTER CARD — ${charName}\nDescription:\n${String(description).trim()}${String(personality).trim() ? `\nPersonality:\n${String(personality).trim()}` : ''}${String(scenario).trim() ? `\nScenario:\n${String(scenario).trim()}` : ''}`);
      }
    } catch (e) { console.debug('[TavernOS HUD] Не удалось прочитать карточку персонажа:', e); }
    try {
      let personaDescription = '';
      if (typeof window.power_user !== 'undefined') personaDescription = window.power_user?.persona_description || '';
      if (!personaDescription) personaDescription = document.querySelector('#persona_description')?.value || '';
      if (!personaDescription && stContext?.persona?.description) personaDescription = stContext.persona.description;
      if (String(personaDescription).trim()) sections.push(`USER PERSONA — ${window.name1 || '{{user}}'}\n${String(personaDescription).trim()}`);
    } catch (e) { console.debug('[TavernOS HUD] Не удалось прочитать Persona:', e); }

    const effectiveScanText = [String(scanText || ''), ...sections].filter(Boolean).join('\n\n');
    for (const name of selected) {
      const data = await loadHudLorebook(name);
      const entries = data && Array.isArray(data.entries) ? data.entries
        : (data && data.entries && typeof data.entries === 'object' ? Object.values(data.entries) : []);
      const activated = entries
        .filter(entry => hudLoreEntryActivates(entry, effectiveScanText, stContext))
        .map(normalizeHudLoreEntry)
        .filter(Boolean);
      if (activated.length) {
        sections.push(`LOREBOOK — ${name}\n${activated.map((x, i) => `Entry ${i + 1}:\n${x}`).join('\n\n')}`);
      }
    }
    if (!sections.length) return '';
    return `\n\n<HUD_EXTERNAL_CONTEXT>\nThe following material is reference context for generating/updating the HUD. Use it to keep names, facts, relationships, locations, and world details consistent. Do not reproduce this section outside the HUD JSON.\n\n${sections.join('\n\n====================\n\n')}\n</HUD_EXTERNAL_CONTEXT>`;
  }

  // window.lastTavernRequest живёт только в памяти вкладки и теряется при перезагрузке страницы
  // или выгрузке вкладки из памяти (частая ситуация на телефоне). Дублируем последний запрос
  // в sessionStorage, чтобы 🔄/➕ работали сразу после открытия чата, до первой обычной генерации.
  const LAST_REQUEST_CACHE_KEY = 'hud_last_tavern_request';
  function persistLastTavernRequest(reqData) {
    try { sessionStorage.setItem(LAST_REQUEST_CACHE_KEY, JSON.stringify(reqData)); } catch (e) {}
  }
  function restoreLastTavernRequest() {
    if (window.lastTavernRequest) return;
    try {
      const cached = sessionStorage.getItem(LAST_REQUEST_CACHE_KEY);
      if (cached) window.lastTavernRequest = JSON.parse(cached);
    } catch (e) {}
  }
  function escapeHtml(str) { if (!str) return ''; const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }

  function defeatWI(text) {
      if (!text || typeof text !== 'string' || text.length < 2) return text;
      return text.charAt(0) + '\u200B' + text.slice(1);
  }

  function showHudToast(type, title, message) {
    let container = document.getElementById('hud-toast-container');
    if (!container) {
      container = document.createElement('div'); container.id = 'hud-toast-container'; container.className = 'hud-toast-container'; document.body.appendChild(container);
    }
    const toast = document.createElement('div'); toast.className = `hud-toast ${type}`;
    let iconSvg = type === 'loading' ? `<svg class="hud-toast-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>` : (type === 'success' ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`);
    toast.innerHTML = `<div class="hud-toast-icon">${iconSvg}</div><div class="hud-toast-content"><div class="hud-toast-title">${title}</div><div class="hud-toast-msg">${message}</div></div>`;
    container.appendChild(toast);
    if (type !== 'loading') { setTimeout(() => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 400); }, 4000); }
    return toast;
  }

function applyTooltips(text) {
    return escapeHtml(text);
  }

  function formatKeyValue(text) {
    if (typeof Intl === 'undefined' || !Intl.Segmenter) return escapeHtml(text);
    const parts = Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text)).map(seg => ({ type: seg.segment.match(/\p{Emoji}/u) ? 'emoji' : 'text', value: seg.segment }));
    let html = '', currentText = '';
    for (let part of parts) {
      if (part.type === 'emoji') {
        if (currentText) { html += `<span class="hud-key-text">${applyTooltips(currentText)}</span>`; currentText = ''; }
        html += `<span class="hud-emoji">${escapeHtml(part.value)}</span>`;
      } else currentText += part.value;
    }
    if (currentText) html += `<span class="hud-key-text">${applyTooltips(currentText)}</span>`;
    return html;
  }

  function buildPillList(value, pillClass, forceSeparate = false) {
      let items = [];
      let delimiter = String(value).includes(';') ? ';' : (String(value).includes('\n') ? '\n' : '. ');
      let rawChunks = String(value).split(delimiter).map(i => i.trim()).filter(i => i);
      for (let chunk of rawChunks) {
          let match = chunk.match(/^([A-Za-zА-Яа-яЁё0-9\s\/\(\),\.]{2,80}?)(:|—|–|\s-)\s*(.*)$/);
          if (match) { items.push({ label: match[1], sep: match[2], text: match[3] }); } 
          else {
              if (items.length > 0 && !forceSeparate) { items[items.length - 1].text += (delimiter === ';' ? '; ' : delimiter) + chunk; } 
              else { items.push({ label: '', sep: '', text: chunk }); }
          }
      }
      return items.map(item => {
          let labelHtml = item.label ? `<span class="hud-pill-label">${escapeHtml(item.label)}${escapeHtml(item.sep)}</span> ` : '';
          return `<div class="${pillClass}">${labelHtml}${applyTooltips(item.text)}</div>`;
      }).join('');
  }

  // Fixed schema defaults. This repairs omitted non-NSFW keys after generation.
  // UI visibility rules are intentionally left intact: empty NSFW values remain hideable.
  const HUD_CHARACTER_DEFAULTS = { N:'empty', A:'empty', C:'empty', R:'empty', B:'empty', Ph:'empty', L:'empty', Th:'empty', K:'empty', Exp:'empty', D:'empty', I:'empty', G:'empty', S:'empty', Rel:'empty', Mem:'empty', Flag:'empty', St:'empty', Exo:'empty', X:'empty', SexLast:'empty', SexCount:'empty', SexReg:'empty', W:'empty', NSFW_Det:'empty', SexRev:'empty' };
  const HUD_USER_DEFAULTS = { A:'empty', C:'empty', Ap:'empty', H:'empty', Rel:'empty', L:'empty', UW:'empty' };
  const HUD_SCENE_DEFAULTS = { T:'empty', Wth:'empty', Dt:'empty', Atm:'empty', Md:'empty' };
  const HUD_MEMORY_DEFAULTS = { timeline:[], mood:{ user:{current:'empty',history:[]}, char:{current:'empty',history:[]} }, route:{user:[],char:[]}, important:[], secrets:[] };
  const HUD_WORLD_DEFAULTS = { headlines:[], rumors:[], ads:[], comments:[] };
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
  function normalizeHUDSchema(parsed) {
    const root = (parsed && typeof parsed === 'object') ? parsed : {};
    // Root keys are already schema keys; only object-field aliases need
    // canonicalization before defaults are applied.
    root.scene = fillMissingObjectFields(root.scene, HUD_SCENE_DEFAULTS);
    root.characters = Array.isArray(root.characters) ? root.characters.map(c => fillMissingObjectFields(c, HUD_CHARACTER_DEFAULTS)) : [];
    if (settings.enableUserBlock) root.user = fillMissingObjectFields(root.user, HUD_USER_DEFAULTS);
    if (settings.enableMemory) {
      root.memory = fillMissingObjectFields(root.memory, HUD_MEMORY_DEFAULTS);
      root.memory.mood = fillMissingObjectFields(root.memory.mood, HUD_MEMORY_DEFAULTS.mood);
      root.memory.mood.user = fillMissingObjectFields(root.memory.mood.user, HUD_MEMORY_DEFAULTS.mood.user);
      root.memory.mood.char = fillMissingObjectFields(root.memory.mood.char, HUD_MEMORY_DEFAULTS.mood.char);
      root.memory.route = fillMissingObjectFields(root.memory.route, HUD_MEMORY_DEFAULTS.route);
    }
    if (settings.enablePhone && (!root.chatsMap || typeof root.chatsMap !== 'object' || Array.isArray(root.chatsMap))) root.chatsMap = {};
    if (settings.enableIntercepts && !Array.isArray(root.intercepts)) root.intercepts = [];
    if (settings.enableDiary && !Array.isArray(root.diary)) root.diary = [];
    if (settings.enableDreams && !Array.isArray(root.dreams)) root.dreams = [];
    if (settings.enableWorld) root.world = fillMissingObjectFields(root.world, HUD_WORLD_DEFAULTS);
    return root;
  }

  function normalizeJSONData(parsed) {
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
    let world = parsed.world || {};
    let chatsMap = {};
    if (typeof parsed.chatsMap === 'object' && parsed.chatsMap !== null) {
      for (const k of Object.keys(parsed.chatsMap)) {
        const c = parsed.chatsMap[k];
        if (!c || typeof c !== 'object') continue;
        chatsMap[toStr(k)] = { owner: toStr(c.owner), participants: toStr(c.participants), messages: cleanArray(c.messages) };
      }
    }
    let interceptsParsed = [];
    if (Array.isArray(parsed.intercepts)) {
      interceptsParsed = parsed.intercepts.map(i => {
        if (typeof i === 'object' && i !== null) return { target: toStr(i.target), chatName: toStr(i.chatName), participants: toStr(i.participants), messages: cleanArray(i.messages) }; return null;
      }).filter(Boolean);
    }
    let diaryParsed = [];
    if (Array.isArray(parsed.diary)) {
      diaryParsed = parsed.diary.map(d => {
        if (typeof d === 'string') return { author:'', time:'', text:d, aboutUser:'' };
        if (typeof d === 'object' && d !== null) return { author:toStr(d.author), time:toStr(d.time), text:toStr(d.text), aboutUser:toStr(d.aboutUser) };
        return null;
      }).filter(Boolean);
    }
    let dreamsParsed = [];
    if (Array.isArray(parsed.dreams)) {
      dreamsParsed = parsed.dreams.map(d => {
        if (typeof d === 'string') return { text: d, meaning: '' }; 
        if (typeof d === 'object' && d !== null) return { text: toStr(d.text), meaning: toStr(d.meaning) }; return null;
      }).filter(d => d !== null);
    }

    // === ПАРСЕР ПАМЯТИ ===
    let memoryParsed = { timeline: [], mood: { user: { current: '', history: [] }, char: { current: '', history: [] } }, route: { user: [], char: [] }, important: [], secrets: [] };
    if (parsed.memory && typeof parsed.memory === 'object') {
        memoryParsed.timeline = cleanArray(parsed.memory.timeline).slice(-5);
        memoryParsed.important = typeof parsed.memory.important === 'string' ? parsed.memory.important.split(';').map(s=>s.trim()).filter(Boolean) : cleanArray(parsed.memory.important);
        const rawMood = parsed.memory.mood;
        if (rawMood && typeof rawMood === 'object') {
            const u = rawMood.user || {}; const c = rawMood.char || {};
            memoryParsed.mood.user = { current: toStr(u.current), history: cleanArray(u.history).slice(-12) };
            memoryParsed.mood.char = { current: toStr(c.current), history: cleanArray(c.history).slice(-12) };
        } else if (rawMood) {
            const shared = toStr(rawMood);
            memoryParsed.mood.user.current = shared;
            memoryParsed.mood.char.current = shared;
        }
        if (parsed.memory.route && typeof parsed.memory.route === 'object') {
            memoryParsed.route.user = cleanArray(parsed.memory.route.user).slice(-20);
            memoryParsed.route.char = cleanArray(parsed.memory.route.char).slice(-20);
        }
        if (Array.isArray(parsed.memory.secrets)) {
            memoryParsed.secrets = parsed.memory.secrets.map(s => {
                if (!s || typeof s !== 'object') return null;
                const status = toStr(s.status || s.state || 'unknown').toLowerCase();
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
                return { fact: toStr(s.fact), level: toStr(s.level || 'medium').toLowerCase(), status, knows, hidden };
            }).filter(s => s && valid(s.fact));
        }
    }

    return {
      scene: mapKeys(parsed.scene), characters: chars.map(mapKeys), user: mapKeys(parsed.user), memory: memoryParsed, chatsMap: chatsMap, intercepts: interceptsParsed, diary: diaryParsed, dreams: dreamsParsed,
      world: { headlines: cleanArray(world.headlines), rumors: cleanArray(world.rumors), ads: cleanArray(world.ads), comments: cleanArray(world.comments) }
    };
  }

  function parseLegacyHUD(content) { return { scene: {}, characters: [], user: {}, memory: { timeline: [], mood: { user: { current: '', history: [] }, char: { current: '', history: [] } }, route: { user: [], char: [] }, important: [], secrets: [] }, intercepts: [], dreams: [], diary: [], world: { headlines: [], rumors: [], ads: [], comments: [] } }; }

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
  // HUD DIAGNOSTICS / SAFE JSON REPAIR
  // ---------------------------------------------------------------------------
  function setHudRepairDiagnostic(patch = {}) {
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
  function repairCommonJsonDialect(jsonStr) {
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

function scoreHudJsonCandidate(parsed) {
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

  function tryParseHudJsonCandidate(candidate) {
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

  function repairGeneratedHudBlock(aiText) {
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

  function parseHUDComplex(contentEncoded) {
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


  // Кэш аватарок по имени персонажа: поиск идёт назад по ВСЕМ .mes в чате (нужно найти
  // самое свежее упоминание имени), в длинном чате это дорогая операция, а вызывается она
  // на каждый рендер карточки HUD. Кэшируем результат и сбрасываем его только когда в чат
  // реально добавляются новые сообщения (см. invalidateAvatarCache()).
  let avatarUrlCache = {};
  function invalidateAvatarCache() { avatarUrlCache = {}; }

  function resolveAvatarUrl(characterName, isPrimary) {
    const searchName = (characterName || '').toLowerCase().trim();
    if (searchName) {
        const allMes = Array.from(document.querySelectorAll('.mes'));
        for (let i = allMes.length - 1; i >= 0; i--) {
            const mes = allMes[i]; const nameEl = mes.querySelector('.mes_name');
            if (nameEl && nameEl.textContent.trim().toLowerCase().includes(searchName.split(' ')[0])) {
                const img = mes.querySelector('.avatar img, .avatar_img');
                if (img) {
                    const src = img.src || (img.style && img.style.backgroundImage ? img.style.backgroundImage.replace(/url\(['"]?|['"]?\)/g, '') : null);
                    if (src && !src.includes('undefined') && !src.includes('none')) return { url: src, thumbUrl: src };
                }
            }
        }
    }
    if (isPrimary) {
        const botMsgs = Array.from(document.querySelectorAll('.mes:not([is_user="true"]):not([is_system="true"]) .avatar img'));
        if (botMsgs.length > 0) {
            const lastBotMsg = botMsgs[botMsgs.length - 1];
            if (lastBotMsg && lastBotMsg.src && !lastBotMsg.src.includes('undefined') && !lastBotMsg.src.includes('none')) return { url: lastBotMsg.src, thumbUrl: lastBotMsg.src };
        }
    }
    if (!window.characters || !Array.isArray(window.characters)) return null;
    let char = window.characters.find(c => c.name && c.name.toLowerCase().trim() === searchName);
    if (!char) char = window.characters.find(c => c.name && c.name.toLowerCase().includes(searchName));
    if (!char && searchName.length > 2) {
        const firstWord = searchName.split(' ')[0].replace(/[^a-zа-яё]/gi, '');
        if (firstWord) char = window.characters.find(c => c.name && c.name.toLowerCase().includes(firstWord));
    }
    if (!char && isPrimary && window.this_chid !== undefined) char = window.characters[window.this_chid];
    if (!char || !char.avatar || char.avatar === 'none') return null;

    let file = char.avatar;
    if (file.startsWith('http') || file.startsWith('data:')) return { url: file, thumbUrl: file };
    if (typeof window.getThumbnailUrl === 'function') return { url: window.getThumbnailUrl('avatar', file), thumbUrl: `/characters/${encodeURIComponent(file)}` };
    return { url: `/thumbnail?type=avatar&file=${encodeURIComponent(file)}`, thumbUrl: `/characters/${encodeURIComponent(file)}` };
  }

  function getAvatarUrl(characterName, isPrimary = false) {
    const searchName = (characterName || '').toLowerCase().trim();
    const cacheKey = searchName + '::' + (isPrimary ? '1' : '0');
    if (avatarUrlCache.hasOwnProperty(cacheKey)) return avatarUrlCache[cacheKey];
    const result = resolveAvatarUrl(characterName, isPrimary);
    avatarUrlCache[cacheKey] = result;
    return result;
  }

  function getUserAvatarUrl() {
    try {
        const selectors = ['#user_avatar_block .avatar.selected img', '#user_avatar_block .avatar_img.selected', '.selected_avatar img', '#avatar_img_me', '.mes[is_user="true"] .avatar img'];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                const src = el.src || (el.style && el.style.backgroundImage ? el.style.backgroundImage.replace(/url\(['"]?|['"]?\)/g, '') : null);
                if (src && src !== '' && !src.includes('undefined') && !src.includes('none')) return src;
            }
        }
        let file = window.user_avatar;
        if (!file && typeof window.getUserAvatar === 'function') file = window.getUserAvatar();
        if (file && file !== 'none') {
            if (file.startsWith('http') || file.startsWith('data:')) return file;
            if (typeof window.getThumbnailUrl === 'function') return window.getThumbnailUrl('user_avatar', file) || window.getThumbnailUrl('avatar', file);
            return `/User Avatars/${encodeURIComponent(file)}`;
        }
    } catch (e) {} return null;
  }

  function buildUserHTML(userData, uid, isChecked) {
    if (!userData || Object.keys(userData).length === 0) return '';
    const personaName = getSafeUserName();
    const avatarUrl = getUserAvatarUrl();
    const avatarHtml = avatarUrl ? `<img src="${avatarUrl}" class="hud-avatar hud-avatar-user" alt="avatar" onerror="this.outerHTML='<div class=&quot;hud-avatar-placeholder hud-avatar-user&quot;></div>'">` : `<div class="hud-avatar-placeholder hud-avatar-user"></div>`;

    const order = ['A', 'C', 'Ap', 'H', 'Rel', 'L', 'UW'];
    let rows = '';
    order.forEach(shortKey => {
      const label = mapKey(shortKey); let value = null;
      for (const [k, v] of Object.entries(userData)) { if (k === shortKey || k.toLowerCase() === label.toLowerCase()) { value = v; break; } }
      if (!value || String(value).toLowerCase() === 'empty' || String(value).toLowerCase() === 'none') return;
      
      let rowClass = 'hud-row hud-user-row';
      if (label.toLowerCase().includes('nsfw')) rowClass += ' full-width nsfw';

      if (label.toLowerCase() === 'отношения') {
        rows += `<div class="${rowClass}"><span class="hud-key">${escapeHtml(label)}:</span> <div class="hud-vertical-container">${buildPillList(value, 'hud-detail-pill')}</div></div>`;
      } else if (label.toLowerCase().includes('nsfw')) {
        rows += `<div class="${rowClass}"><span class="hud-key">🔞 ${escapeHtml(label)}:</span> <div class="hud-vertical-container">${buildPillList(value, 'hud-nsfw-pill')}</div></div>`;
      } else {
        rows += `<div class="${rowClass}"><span class="hud-key">${escapeHtml(label)}:</span> <span class="hud-value">${applyTooltips(String(value))}</span></div>`;
      }
    });
    if (!rows) return '';
    return `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}"><div class="hud-header hud-user-header"><div class="hud-header-info">${avatarHtml}<div class="hud-header-text"><span class="hud-title">${escapeHtml(personaName)}</span></div></div></div><div class="hud-body hud-user-body">${rows}</div></div>`;
  }

  function buildCharacterHTML(charData, uid, isChecked, isPrimary) {
    if (!charData || Object.keys(charData).length === 0) return '';
    const charName = charData['Имя'] || 'Unknown NPC';
    const avatar = getAvatarUrl(charName, isPrimary);
    const avatarHtml = avatar ? `<img src="${avatar.url}" data-hud-fallback="${avatar.thumbUrl}" class="hud-avatar" alt="avatar" onerror="if(!this.dataset.hudTried && this.dataset.hudFallback){this.dataset.hudTried='1'; this.src=this.dataset.hudFallback;} else {this.outerHTML='<div class=&quot;hud-avatar-placeholder&quot;>👤</div>';}">` : `<div class="hud-avatar-placeholder">👤</div>`;

    let html = `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}"><div class="hud-header"><div class="hud-header-info">${avatarHtml}<div class="hud-header-text"><span class="hud-title">${escapeHtml(charName)}</span></div></div></div><div class="hud-body">`;

    for (const [key, value] of Object.entries(charData)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'имя') continue; 
      if (value === null || value === undefined || value === '' || String(value).toLowerCase() === 'empty' || String(value).toLowerCase() === 'none') continue;
      let rowClass = FULL_WIDTH_KEYS.some(k => lowerKey.includes(k)) ? 'hud-row full-width' : 'hud-row';
      if (DRAMA_KEYS.some(k => lowerKey.includes(k))) rowClass += ' drama-alert';
      if (lowerKey.includes('nsfw') || lowerKey.includes('секс') || lowerKey.includes('партнеров')) rowClass += ' nsfw';

      let icon = '';
      if (lowerKey === 'возраст') icon = '⏳ '; else if (lowerKey === 'одежда') icon = '👕 ';
      else if (lowerKey === 'роль') icon = '🎭 '; else if (lowerKey === 'место') icon = '📍 ';
      else if (lowerKey === 'цели') icon = '🎯 '; else if (lowerKey === 'инвентарь') icon = '🎒 ';
      else if (lowerKey === 'статус') icon = '📌 '; else if (lowerKey === 'тело') icon = '🧍 ';
      else if (lowerKey === 'мысли') icon = '💭 '; else if (lowerKey === 'ожидание vs реальность') icon = '🔮 ';
      else if (lowerKey === 'общие воспоминания') icon = '🎞️ '; else if (lowerKey === 'флаг-монитор') icon = '🚩 ';
      else if (lowerKey === 'социальное разоблачение') icon = '👁️ '; else if (lowerKey === 'физиология') icon = '🩸 ';
      else if (lowerKey === 'скрытый подтекст' || lowerKey === 'детали') icon = '👁️‍🗨️ ';
      else if (lowerKey === 'отношения') icon = '🤝 '; else if (lowerKey === 'ревность') icon = '💔 ';
      else if (lowerKey === 'конфликт') icon = '⚔️ '; else if (lowerKey === 'последний секс') icon = '🛏️ ';
      else if (lowerKey === 'количество партнеров') icon = '👥 '; else if (lowerKey === 'регулярность секса') icon = '📈 ';
      else if (lowerKey === 'отзыв о сексе') icon = '📝 '; else if (lowerKey.includes('детализация nsfw')) icon = '🔥 ';
      else if (lowerKey === 'nsfw') icon = '🔞 ';

      let valueClass = TRUNCATE_KEYS.some(k => lowerKey.includes(k)) ? 'hud-value hud-truncate' : 'hud-value';

      if (lowerKey === 'ключ') {
        const items = String(value).split(';').filter(i => i.trim().length > 0).map(i => `<div class="hud-key-item">${formatKeyValue(i.trim())}</div>`).join('');
        html += `<div class="hud-key-block full-width"><span class="hud-key-label">${escapeHtml(key)}:</span> <div class="hud-vertical-container hud-key-list">${items}</div></div>`;
      } else if (lowerKey === 'инвентарь') {
        html += `<div class="${rowClass}"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div class="hud-inventory-grid">${buildPillList(value, 'hud-inventory-pill')}</div></div>`;
      } else if (lowerKey === 'nsfw' || lowerKey === 'детализация nsfw' || lowerKey === 'последний секс') {
        html += `<div class="${rowClass}"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div class="hud-vertical-container">${buildPillList(value, 'hud-nsfw-pill')}</div></div>`;
      } else if (lowerKey === 'расписание') {
        const items = String(value).split(String(value).includes(';') ? /;/ : /(?:\.\s+(?=[А-ЯA-ZА-ЯЁ])|\n)/)
          .filter(i => i.trim().length > 0).map(i => {
            let text = i.trim().replace(/\.$/, ''); let timeMatch = text.match(/^([\d]{1,2}:\d{2})\s*[-—–:]?\s*(.*)$/);
            return timeMatch ? `<div class="hud-schedule-item"><div class="hud-schedule-time">${escapeHtml(timeMatch[1])}</div><div class="hud-schedule-event">${applyTooltips(timeMatch[2])}</div></div>` : `<div class="hud-schedule-item"><div class="hud-schedule-event">${applyTooltips(text)}</div></div>`;
          }).join('');
        html += `<div class="${rowClass} full-width"><div class="hud-schedule-container">${items}</div></div>`;
      } else if (lowerKey === 'ожидание vs реальность') {
        html += `<div class="${rowClass} full-width"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div class="hud-exp-reality">${buildPillList(value, '')}</div></div>`;
      } else if (lowerKey === 'глубина конфликта') {
        html += `<div class="${rowClass}"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div class="hud-vertical-container">${buildPillList(value, 'hud-conflict-pill')}</div></div>`;
      } else if (lowerKey === 'отзыв о сексе') {
        html += `<div class="${rowClass} full-width"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <span class="${valueClass} hud-sex-rev">${applyTooltips(String(value)).replace(/([★☆]+)/g, '<span class="hud-stars-rating">$1</span>')}</span></div>`;
      } else if (lowerKey === 'отношения' || lowerKey === 'цели' || lowerKey === 'ревность' || lowerKey === 'общие воспоминания' || lowerKey === 'флаг-монитор') {
        html += `<div class="${rowClass}"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div class="hud-vertical-container">${buildPillList(value, 'hud-detail-pill', (lowerKey === 'общие воспоминания' || lowerKey === 'флаг-монитор'))}</div></div>`;
      } else {
        html += `<div class="${rowClass}"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <span class="${valueClass}">${applyTooltips(String(value))}</span></div>`;
      }
    }
    return html + `</div></div>`;
  }
  
  function buildMemoryHTML(memoryData, uid, isChecked) {
    if (!memoryData || Object.keys(memoryData).length === 0) return '';
    let html = `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}"><div class="hud-body" style="grid-template-columns: 1fr;">`;

    // 1. ТАЙМЛАЙН (Вертикальная линия)
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

    // 2. МАРШРУТЫ (Связанные узлы пути)
    const buildRouteHTML = (routeArr, entityLabel) => {
        if (!routeArr || routeArr.length === 0) return '';
        let rHtml = `<div class="hud-route-group"><div class="hud-route-name">${escapeHtml(entityLabel)}</div><div class="hud-route-path">`;
        routeArr.forEach((item, index) => {
            let parts = String(item).split(/[-—–]/).map(s => s.trim());
            let time = parts[0] || ''; let place = parts[1] || ''; let action = parts.slice(2).join(' - ') || '';
            let isLast = index === routeArr.length - 1;
            if (time.match(/^\[?[\d]{1,2}\s*:\s*\d{2}\]?$/)) {
                 rHtml += `<div class="hud-route-node ${isLast ? 'current' : ''}"><div class="hud-route-info"><div class="hud-route-time">${escapeHtml(time)}</div><div class="hud-route-place">${escapeHtml(place)}</div>${action ? `<div class="hud-route-action">${escapeHtml(action)}</div>` : ''}</div></div>`;
            } else {
                 rHtml += `<div class="hud-route-node ${isLast ? 'current' : ''}"><div class="hud-route-info"><div class="hud-route-place">${escapeHtml(item)}</div></div></div>`;
            }
        });
        return rHtml + `</div></div>`;
    };

    if (memoryData.route && (memoryData.route.user?.length > 0 || memoryData.route.char?.length > 0)) {
      let routeHtml = '';
      if (memoryData.route.user?.length > 0) routeHtml += buildRouteHTML(memoryData.route.user, getSafeUserName());
      if (memoryData.route.char?.length > 0) routeHtml += buildRouteHTML(memoryData.route.char, 'NPC');
      html += `<div class="hud-row full-width"><span class="hud-key">📍 Маршруты:</span> ${routeHtml}</div>`;
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
         // normalizeJSONData stores people who do not know the secret in `hidden`.
         const unawareValue = s.unaware ?? s.hidden;
         let uCount = Array.isArray(unawareValue) ? unawareValue.length : (unawareValue && unawareValue !== 'none' ? 1 : 0);
         let total = kCount + uCount;
         let ratio = total > 0 ? Math.round((kCount / total) * 10) : 0;
         let bar = '█'.repeat(ratio) + '░'.repeat(10 - ratio);
         let spreadText = total > 0 ? `<div class="hud-secret-spread">KNOWLEDGE <span class="hud-secret-bar">${bar}</span> ${kCount} / ${total}</div>` : '';

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
                    <span class="hud-secret-lvl">${lvlText}</span>
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

  function buildPhoneTabsHTML(chatsMap, uid, isChecked, mainCharName) {
    const chatKeys = Object.keys(chatsMap || {});
    let html = `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}"><div class="hud-phone-mockup">`;
    if (chatKeys.length === 0) {
      return html + `<div class="hud-phone-empty"><div class="hud-phone-empty-icon">📱</div><div>Нет сообщений</div><small>В текущем повествовании нет доступных разговоров.</small></div></div></div>`;
    }
    let chatTabsHeader = `<div class="hud-phone-subtabs">`;
    let chatBodies = ``;

    chatKeys.forEach((rawChatName, idx) => {
      let chatObj = chatsMap[rawChatName];
      let isSubActive = idx === 0 ? 'active' : '';

      // Парсинг владельца телефона с фолбэком
      let rawOwner = String(chatObj.owner || '').trim();
      let activeOwner = (rawOwner && rawOwner.toLowerCase() !== 'empty' && rawOwner.toLowerCase() !== 'none') ? rawOwner : mainCharName;
      let ownerDisplay = `📱 ТЕЛЕФОН (${escapeHtml(activeOwner || 'Unknown')})`;

      // Обрезаем дичь от ИИ в названиях.
      // Если название имеет вид «Владелец → Контакт», показываем только контакт.
      // Это влияет ТОЛЬКО на подпись чата/контакта, не на разбор и направление сообщений.
      let displayChatName = rawChatName.replace(/<[^>]+>/g, '').trim();
      let dashIndex = displayChatName.indexOf(' — ');
      if (dashIndex === -1) dashIndex = displayChatName.indexOf(' - ');
      if (dashIndex > 0) displayChatName = displayChatName.substring(0, dashIndex).trim();

      const arrowParts = displayChatName.split(/\s*(?:→|->|←|↔|↔︎)\s*/).map(s => s.trim()).filter(Boolean);
      if (arrowParts.length > 1) {
        const ownerNorm = activeOwner.toLowerCase().replace(/\s+/g, ' ').trim();
        const ownerFirst = ownerNorm.split(' ')[0];
        const ownerIndex = arrowParts.findIndex(part => {
          const partNorm = part.toLowerCase().replace(/\s+/g, ' ').trim();
          return partNorm === ownerNorm || partNorm === ownerFirst || partNorm.startsWith(ownerNorm + ' ') || ownerNorm.startsWith(partNorm + ' ');
        });

        if (ownerIndex !== -1) {
          const contactParts = arrowParts.filter((_, i) => i !== ownerIndex);
          displayChatName = contactParts.join(' → ').trim();
        } else {
          // Если владельца нет в строке, не угадываем направление: берём правую часть.
          displayChatName = arrowParts[arrowParts.length - 1];
        }
      }

      let latestTime = '12:00', unreadCount = 0;
      if (Array.isArray(chatObj.messages)) {
        chatObj.messages.forEach(m => {
          let timeMatch = m.match(/\b\d{1,2}:\d{2}\b/); if (timeMatch) latestTime = timeMatch[0];
          if (/unread|не прочитан/i.test(m.replace(/\[удалено\]|\[черновик\]/gi, ''))) unreadCount++;
        });
      }
      
      chatTabsHeader += `<button class="hud-phone-subtab ${isSubActive}" data-subtarget="subchat-${uid}-${idx}">${defeatWI(escapeHtml(displayChatName))} ${unreadCount > 0 ? `<span class="hud-unread-badge">${unreadCount}</span>` : ''}</button>`;

      chatBodies += `<div class="hud-phone-subbody ${isSubActive}" id="subchat-${uid}-${idx}">
        <div class="hud-phone-statusbar"><span class="hud-phone-time">${escapeHtml(latestTime)}</span><span class="hud-phone-owner-label">${ownerDisplay}</span><div class="hud-phone-status-icons"><span>📶</span><span>🔋</span></div></div>
        <div class="hud-phone-header"><span class="hud-phone-back">⟨</span><div class="hud-phone-title-group" ${chatObj.participants ? 'style="cursor:pointer;" title="Нажми, чтобы увидеть участников"' : ''}><span class="hud-phone-name">${defeatWI(escapeHtml(displayChatName))} ${chatObj.participants ? '<span style="font-size:0.8em; opacity:0.7;">▾</span>' : ''}</span>${chatObj.participants ? `<div class="hud-phone-participants-list">👥 Участники: ${escapeHtml(chatObj.participants)}</div>` : ''}</div><span class="hud-phone-options">⋮</span></div>
        <div class="hud-phone-chat-area">`;
		
		let activeDraft = "";

      if (Array.isArray(chatObj.messages)) {
        chatObj.messages.forEach(msgStr => {
          if (!msgStr.trim()) return;
          let parts = msgStr.replace(/^(?:M|Msg|Сообщение|Chat|Чат):\s*/i, '').trim().split('|').map(s => s.trim());
          let mainPart = parts[0], msgTime = parts.length > 1 ? parts[1] : '', msgStatus = parts.length > 2 ? parts[2] : '';

          if (parts.length === 1) {
            const fallbackMatch = mainPart.match(/(.*?)\s*(?:\|?\s*)(\b(?:Вчера|Сегодня|Завтра)[,\s]*\d{1,2}:\d{2}|\b\d{1,2}:\d{2})(?:\s*\|?\s*)(✓+|read|unread|доставлен[а-я]*|прочитан[а-я]*|отправлен[а-я]*|draft|черновик)?$/i);
            if (fallbackMatch) { mainPart = fallbackMatch[1].trim(); msgTime = fallbackMatch[2].trim(); msgStatus = (fallbackMatch[3] || '').trim(); }
          }

          // === НАЧАЛО НОВОГО КОДА ===
              let isDeleted = msgStatus.toLowerCase().includes('delete') || msgStatus.toLowerCase().includes('удалено') || mainPart.toLowerCase().includes('[удалено]');
              let isDraft = msgStatus.toLowerCase().includes('draft') || msgStatus.toLowerCase().includes('черновик') || mainPart.toLowerCase().includes('[черновик]');

              mainPart = mainPart.replace(/\[удалено\]|\[черновик\]|✓+/gi, '').trim();

              let sender = "Unknown", message = mainPart, match = mainPart.match(/^([^:-]+)(?:\s*(?:->|→)\s*([^:]+))?:\s*(.*)$/);
              if (match) { sender = match[1].trim(); message = match[3].trim(); }

              const senderLower = sender.toLowerCase();
              const mainCharLower = String(mainCharName || '').toLowerCase();
              let isOutgoing = Boolean(mainCharLower && senderLower.includes(mainCharLower.split(' ')[0]));
              // В JSON модель может называть владельца телефона User/You/Вы.
              // Это тоже исходящее сообщение от владельца, а не входящее.
              if (/^(?:user|you|вы|я|player)$/i.test(sender.trim())) isOutgoing = true;

              // ЛОВИМ ЧЕРНОВИК (Прячем из чата и сохраняем)
              if (isDraft && isOutgoing) {
                  activeDraft = message;
                  return; 
              }

              // ЛОВИМ УДАЛЕННОЕ (Рисуем кликабельный спойлер)
              if (isDeleted) { 
                  chatBodies += `<div class="hud-msg-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}">
                    ${!isOutgoing ? `<div class="hud-msg-avatar">${sender.charAt(0).toUpperCase()}</div>` : ''}
                    <div class="hud-msg-content" style="max-width: 100%;">
                      <span class="hud-msg-sender">${escapeHtml(sender)}</span>
                      <details class="hud-msg-deleted-details">
                        <summary>🚫 Сообщение удалено</summary>
                        <div class="hud-msg-deleted-text">${escapeHtml(message)}</div>
                      </details>
                    </div>
                  </div>`;
                  return; 
              }

          let statusHtml = '';
          if (isOutgoing) {
            let s = msgStatus.toLowerCase();
            if (s.includes('read') || s.includes('прочитан') || s.includes('✓✓')) statusHtml = '<span class="msg-status read" style="color: #4facfe; font-weight: bold;">✓✓</span>';
            else if (s.includes('delivered') || s.includes('доставлен')) statusHtml = '<span class="msg-status delivered" style="opacity: 0.8;">✓✓</span>';
            else statusHtml = '<span class="msg-status sent" style="opacity: 0.8;">✓</span>';
          } else if (msgStatus.toLowerCase().includes('unread') || msgStatus.toLowerCase().includes('не прочитан')) {
            statusHtml = '<span class="msg-status unread-dot"></span>';
          }

          // === ЛОВИМ ГОЛОСОВЫЕ СООБЩЕНИЯ ===
              let isVoice = false;
              let voiceDur = "";
              let voiceMatch = message.match(/\[(?:VOICE|ГОЛОС)_?(\d{1,2}:\d{2})?\]/i);
              if (voiceMatch) {
                  isVoice = true;
                  voiceDur = voiceMatch[1] || "0:15"; // Берем длину аудио или ставим 15 сек по умолчанию
                  message = message.replace(voiceMatch[0], '').trim(); // Вырезаем тег из текста
              }

              // СОБИРАЕМ ВНУТРЕННОСТИ ПУЗЫРЯ (Текст или Плеер)
              let msgInner = isVoice 
                  ? `<div class="hud-voice-player"><div class="hud-voice-btn">▶</div><div class="hud-voice-line"></div><span class="hud-voice-time">${voiceDur}</span></div><details class="hud-voice-details"><summary>Расшифровка</summary><div class="hud-voice-text">${escapeHtml(message)}</div></details>`
                  : `<div class="hud-msg-text" style="word-break: break-word;">${escapeHtml(message)}</div>`;

              // РИСУЕМ ФИНАЛЬНОЕ СООБЩЕНИЕ
              chatBodies += `<div class="hud-msg-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}">
                ${!isOutgoing ? `<div class="hud-msg-avatar">${sender.charAt(0).toUpperCase()}</div>` : ''}
                <div class="hud-msg-content" style="max-width: 100%;">
                  <span class="hud-msg-sender">${escapeHtml(sender)}</span>
                  <div class="hud-msg-bubble">
                    ${msgInner}
                    ${(msgTime || statusHtml) ? `<div class="hud-msg-meta" style="display: flex; justify-content: flex-end; align-items: center; gap: 4px; font-size: 0.75em; opacity: 0.6; margin-top: 4px;"><span class="hud-msg-time">${escapeHtml(msgTime)}</span>${statusHtml}</div>` : ''}
                  </div>
                </div>
              </div>`;
        });
      }
      chatBodies += `</div><div class="hud-phone-input-bar"><span class="hud-phone-attach">+</span><div class="hud-phone-inputfield ${activeDraft ? 'draft-active' : 'placeholder'}">${activeDraft ? escapeHtml(activeDraft) : 'Сообщение...'}</div><span class="hud-phone-send disabled">↑</span></div></div>`;
    });
    return html + chatTabsHeader + `</div>` + chatBodies + `</div></div>`;
  }


  function buildInterceptsHTML(interceptsData, uid, isChecked) {
    if (!interceptsData || interceptsData.length === 0) return '';
    let html = `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}"><div class="hud-phone-mockup intercept-mode">`;
    let chatTabsHeader = `<div class="hud-phone-subtabs">`;
    let chatBodies = ``;

    interceptsData.forEach((intercept, idx) => {
      let targetName = (intercept.target || 'Unknown').replace(/<[^>]+>/g, '').trim(), chatName = (intercept.chatName || 'Chat').replace(/<[^>]+>/g, '').trim();
      // Для перехвата показываем именно контакт, а не владельца телефона.
      // Направление сообщений ниже не меняем: target по-прежнему определяет владельца.
      const interceptArrowParts = chatName.split(/\s*(?:→|->|←|↔|↔︎)\s*/).map(s => s.trim()).filter(Boolean);
      if (interceptArrowParts.length > 1) {
        const targetNorm = targetName.toLowerCase().replace(/\s+/g, ' ').trim();
        const targetFirst = targetNorm.split(' ')[0];
        const targetIndex = interceptArrowParts.findIndex(part => {
          const partNorm = part.toLowerCase().replace(/\s+/g, ' ').trim();
          return partNorm === targetNorm || partNorm === targetFirst ||
            partNorm.startsWith(targetNorm + ' ') || targetNorm.startsWith(partNorm + ' ');
        });
        if (targetIndex !== -1) {
          const contactParts = interceptArrowParts.filter((_, i) => i !== targetIndex);
          chatName = contactParts.join(' → ').trim();
        } else {
          chatName = interceptArrowParts[interceptArrowParts.length - 1];
        }
      }

      let latestTime = '--:--', unreadCount = 0;
      if (Array.isArray(intercept.messages)) {
        intercept.messages.forEach(m => {
          let timeMatch = m.match(/\b\d{1,2}:\d{2}\b/); if (timeMatch) latestTime = timeMatch[0];
          if (/unread|не прочитан/i.test(m.replace(/\[удалено\]|\[черновик\]/gi, ''))) unreadCount++;
        });
      }

      chatTabsHeader += `<button class="hud-phone-subtab intercept-tab ${idx === 0 ? 'active' : ''}" data-subtarget="subhack-${uid}-${idx}">👁️ ${defeatWI(escapeHtml(targetName))} ${unreadCount > 0 ? `<span class="hud-unread-badge">${unreadCount}</span>` : ''}</button>`;

      chatBodies += `<div class="hud-phone-subbody ${idx === 0 ? 'active' : ''}" id="subhack-${uid}-${idx}">
        <div class="hud-phone-statusbar"><span class="hud-phone-time">${escapeHtml(latestTime)}</span><span class="hud-phone-owner-label intercept-status">📡 ПЕРЕХВАТ (${escapeHtml(targetName)})</span><div class="hud-phone-status-icons"><span class="hud-intercept-icon">⚠</span></div></div>
        <div class="hud-phone-header hud-intercept-header">
          <span class="hud-phone-back hud-intercept-icon">⟨</span>
          <div class="hud-phone-title-group" ${intercept.participants ? 'style="cursor:pointer;" title="Нажми, чтобы увидеть участников"' : ''}><span class="hud-phone-name">${defeatWI(escapeHtml(chatName))} ${intercept.participants ? '<span style="font-size:0.8em; opacity:0.7;">▾</span>' : ''}</span>${intercept.participants ? `<div class="hud-phone-participants-list">👥 Участники: ${escapeHtml(intercept.participants)}</div>` : ''}</div>
          <span class="hud-phone-options hud-intercept-icon">⋮</span>
        </div>
        <div class="hud-phone-chat-area">`;

      if (Array.isArray(intercept.messages)) {
        intercept.messages.forEach(msgStr => {
          if (!msgStr.trim()) return;
          let parts = msgStr.replace(/^(?:M|Msg|Сообщение|Chat|Чат):\s*/i, '').trim().split('|').map(s => s.trim());
          let mainPart = parts[0], msgTime = parts.length > 1 ? parts[1] : '';

          if (parts.length === 1) {
            const fallbackMatch = mainPart.match(/(.*?)\s*(?:\|?\s*)(\b(?:Вчера|Сегодня|Завтра)[,\s]*\d{1,2}:\d{2}|\b\d{1,2}:\d{2})/i);
            if (fallbackMatch) { mainPart = fallbackMatch[1].trim(); msgTime = fallbackMatch[2].trim(); }
          }
          mainPart = mainPart.replace(/\[удалено\]|\[черновик\]|✓+/gi, '').trim();
          let sender = "Unknown", message = mainPart, match = mainPart.match(/^([^:-]+)(?:\s*(?:->|→)\s*([^:]+))?:\s*(.*)$/);
          if (match) { sender = match[1].trim(); message = match[3].trim(); }

          let isOutgoing = (targetName && sender.toLowerCase().includes(targetName.toLowerCase().split(' ')[0]));
          chatBodies += `<div class="hud-msg-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}">${!isOutgoing ? `<div class="hud-msg-avatar hud-intercept-avatar">${sender.charAt(0).toUpperCase()}</div>` : ''}<div class="hud-msg-content" style="max-width: 100%;"><span class="hud-msg-sender">${escapeHtml(sender)}</span><div class="hud-msg-bubble"><div class="hud-msg-text" style="word-break: break-word;">${escapeHtml(message)}</div>${msgTime ? `<div class="hud-msg-meta" style="display: flex; justify-content: flex-end; align-items: center; gap: 4px; font-size: 0.75em; opacity: 0.6; margin-top: 4px;"><span class="hud-msg-time">${escapeHtml(msgTime)}</span></div>` : ''}</div></div></div>`;
        });
      }
      chatBodies += `</div><div class="hud-phone-input-bar hud-intercept-input"><span class="hud-phone-attach hud-intercept-icon">⚠</span><div class="hud-phone-inputfield placeholder hud-intercept-icon">ACCESS DENIED - READ ONLY</div></div></div>`;
    });
    return html + chatTabsHeader + `</div>` + chatBodies + `</div></div>`;
  }

  function buildDreamHTML(dreamsData, uid, isChecked) {
    if (!dreamsData || dreamsData.length === 0) return '';
    let html = `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}"><div class="hud-dream-container"><div class="hud-dream-moon">🌙 Z z z . . .</div>`;
    dreamsData.forEach(dream => { 
      html += `<div class="hud-dream-entry"><div class="hud-dream-text">✨ ${escapeHtml(dream.text)}</div>`;
      if (dream.meaning && dream.meaning.toLowerCase() !== 'none' && dream.meaning.toLowerCase() !== 'empty') html += `<div class="hud-dream-meaning"><span class="hud-dream-meaning-label">🔮 Смысл:</span> ${escapeHtml(dream.meaning)}</div>`;
      html += `</div>`; 
    });
    return html + `</div></div>`;
  }

  function buildDiaryHTML(diaryData, uid, isChecked) {
    if (!diaryData || diaryData.length === 0) return '';
    let html = `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}"><div class="hud-diary-container">`;
    diaryData.forEach(entry => {
      if (typeof entry === 'string') {
        let parts = entry.split('|'); let time = parts[0].trim(); let text = parts.length > 1 ? parts.slice(1).join('|').trim() : '';
        if (!text) { text = time; time = 'Скрытая запись'; }
        html += `<div class="hud-diary-entry"><div class="hud-diary-time">${escapeHtml(time)}</div><div class="hud-diary-text">${escapeHtml(text)}</div></div>`;
      } else {
        const aboutUser = entry.aboutUser && entry.aboutUser.toLowerCase() !== 'none' && entry.aboutUser.toLowerCase() !== 'empty' ? entry.aboutUser : '';
        html += `<div class="hud-diary-entry">${entry.author && entry.author.toLowerCase() !== 'none' && entry.author.toLowerCase() !== 'empty' ? `<div class="hud-diary-author">${escapeHtml(entry.author)}</div>` : ''}<div class="hud-diary-time">${escapeHtml(entry.time)}</div><div class="hud-diary-text">${escapeHtml(entry.text)}</div>${aboutUser ? `<div class="hud-diary-about-user"><span class="hud-diary-about-label">О ней:</span> ${escapeHtml(aboutUser)}</div>` : ''}</div>`;
      }
    });
    return html + `</div></div>`;
  }

  function buildWorldHTML(worldData, uid, isChecked) {
    if (!Object.values(worldData).some(arr => Array.isArray(arr) && arr.length > 0)) return '';
    let html = `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}"><div class="hud-world-container">`;
    if (worldData.headlines && worldData.headlines.length > 0) {
      html += `<div class="hud-world-section"><div class="hud-world-title">📰 Главные новости</div>`;
      worldData.headlines.forEach(hl => { let parts = hl.split('|'); html += `<details class="hud-news-article"><summary>${escapeHtml(parts[0].trim())}</summary><div class="article-text">${escapeHtml(parts.length > 1 ? parts.slice(1).join('|').trim() : '')}</div></details>`; });
      html += `</div>`;
    }
    if (worldData.rumors && worldData.rumors.length > 0) {
      html += `<div class="hud-world-section"><div class="hud-world-title">🗣️ Слухи</div><ul class="hud-world-list">`;
      worldData.rumors.forEach(r => html += `<li>${escapeHtml(r)}</li>`);
      html += `</ul></div>`;
    }
    if (worldData.ads && worldData.ads.length > 0) {
      html += `<div class="hud-world-section"><div class="hud-world-title">📌 Доска объявлений</div><div class="hud-ads-grid">`;
      worldData.ads.forEach(ad => html += `<div class="hud-ad-card">${escapeHtml(ad)}</div>`);
      html += `</div></div>`;
    }
    if (worldData.comments && worldData.comments.length > 0 && settings.showComments) {
      html += `<div class="hud-world-section"><div class="hud-world-title">💬 Комментарии Сети</div><div class="hud-comments-list">`;
      worldData.comments.forEach(c => html += `<div class="hud-comment">${escapeHtml(c)}</div>`);
      html += `</div></div>`;
    }
    return html + `</div></div>`;
  }

  // Вспомогательная функция для генерации опций шрифтов (все поддерживают кириллицу)
  function makeFontOptions(selectedVal) {
    const groups = {
      "Базовые (System)": [
        {v:"inherit", n:"Тема Tavern"}, {v:"system-ui, sans-serif", n:"Системный (Apple/UI)"}, {v:"'Times New Roman', serif", n:"Times New Roman"}, {v:"'Courier New', monospace", n:"Courier New"}, {v:"Arial, sans-serif", n:"Arial"}
      ],
      "Современные & UI (Clean)": [
        {v:"'Roboto', sans-serif", n:"Roboto"}, {v:"'Montserrat', sans-serif", n:"Montserrat"}, {v:"'Open Sans', sans-serif", n:"Open Sans"}, {v:"'Nunito', sans-serif", n:"Nunito"}, {v:"'Comfortaa', cursive", n:"Comfortaa"}, {v:"'Oswald', sans-serif", n:"Oswald"}
      ],
      "Киберпанк & Sci-Fi": [
        {v:"'Jura', sans-serif", n:"Jura (Технический)"}, {v:"'Unbounded', sans-serif", n:"Unbounded (Неоновый)"}, {v:"'Russo One', sans-serif", n:"Russo One (Тяжелый)"}, {v:"'Exo 2', sans-serif", n:"Exo 2 (Космос)"}, {v:"'Rubik Mono One', sans-serif", n:"Rubik Mono (Блок)"}, {v:"'Press Start 2P', cursive", n:"Press Start 2P (Пиксель)"}
      ],
      "Фэнтези & Готика": [
        {v:"'Playfair Display', serif", n:"Playfair (Элегантный)"}, {v:"'Cormorant Garamond', serif", n:"Cormorant (Древний)"}, {v:"'Philosopher', sans-serif", n:"Philosopher (Эльфийский)"}, {v:"'Alice', serif", n:"Alice (Винтаж)"}, {v:"'Lora', serif", n:"Lora (Магический)"}, {v:"'Kurale', serif", n:"Kurale (Сказка)"}, {v:"'Eczar', serif", n:"Eczar (Алхимия)"}, {v:"'Kelly Slab', cursive", n:"Kelly Slab (Дизельпанк)"}
      ],
      "Рукописные & Дневник": [
        {v:"'Caveat', cursive", n:"Caveat (Быстрый)"}, {v:"'Pacifico', cursive", n:"Pacifico (Маркер)"}, {v:"'Marck Script', cursive", n:"Marck Script (Каллиграфия)"}, {v:"'Bad Script', cursive", n:"Bad Script (Почерк)"}, {v:"'Neucha', cursive", n:"Neucha (Карандаш)"}, {v:"'Pangolin', cursive", n:"Pangolin (Мягкий)"}, {v:"'Amatic SC', cursive", n:"Amatic SC (Тонкий)"}
      ]
    };
    let html = '';
    for (const [group, fonts] of Object.entries(groups)) {
      html += `<optgroup label="${group}">`;
      for (const f of fonts) {
        html += `<option value="${f.v}" ${selectedVal === f.v ? 'selected' : ''}>${f.n}</option>`;
      }
      html += `</optgroup>`;
    }
    return html;
  }

  function renderHUD(data) {
    if (!data || Object.keys(data).length === 0) return '';
    const hasMemory = Boolean(data.memory && (
      (Array.isArray(data.memory.timeline) && data.memory.timeline.length) ||
      (Array.isArray(data.memory.important) && data.memory.important.length) ||
      (Array.isArray(data.memory.secrets) && data.memory.secrets.length) ||
      (data.memory.mood && ((data.memory.mood.user?.current || data.memory.mood.user?.history?.length) || (data.memory.mood.char?.current || data.memory.mood.char?.history?.length))) ||
      (data.memory.route && ((data.memory.route.user?.length || 0) + (data.memory.route.char?.length || 0) > 0))
    ));
    const hasPhone = Boolean(settings.enablePhone && data.chatsMap && Object.keys(data.chatsMap).length > 0);
    if (data.characters.length === 0 && (!data.intercepts || data.intercepts.length === 0) && data.diary.length === 0 && data.dreams.length === 0 && Object.values(data.world || {}).every(v => !v || !v.length) && Object.keys(data.scene).length === 0 && Object.keys(data.user || {}).length === 0 && !hasMemory && !hasPhone) return '';

    const baseId = Date.now() + '-' + Math.random().toString(36).slice(2);
    let osSubtitleHtml = '', mainCharName = '';
    if (data.characters.length > 0) mainCharName = data.characters[0]['Имя'] || '';

    let tRaw = data.scene['Время'] || '', wRaw = data.scene['Погода'] || '', dRaw = data.scene['Дата'] || '';
    let phaseClass = 'phase-night'; 
    let phaseLow = tRaw.toLowerCase();
    
    let hourMatch = tRaw.match(/(\d{1,2}):\d{2}/);
    if (hourMatch) {
      let hour = parseInt(hourMatch[1], 10);
      if (hour >= 5 && hour < 10) phaseClass = 'phase-morning';       
      else if (hour >= 10 && hour < 18) phaseClass = 'phase-day';     
      else if (hour >= 18 && hour < 20) phaseClass = 'phase-evening'; 
      else phaseClass = 'phase-night';                                
    } else if (/\bутр\w*|\bmorn\w*/.test(phaseLow)) phaseClass = 'phase-morning';
    else if (/\bдень\b|\bдн[ёе]м\b|\bday\b/.test(phaseLow)) phaseClass = 'phase-day';
    else if (/\bвечер\w*|\beven\w*/.test(phaseLow)) phaseClass = 'phase-evening';

    let wClass = 'weather-clear', wLow = wRaw.toLowerCase(), wIntensity = '';
    
    if (wLow.match(/гроз|молни|шторм|thunder|storm/)) {
      wClass = 'weather-storm';
    } else if (wLow.match(/град|hail/)) {
      wClass = 'weather-hail';
    } else if (wLow.match(/снег|снеж|snow|метел|вьюг|blizzard|буран/)) {
      wClass = 'weather-snow';
      if (wLow.match(/метел|вьюг|blizzard|сильн|буран|heavy|бур/)) wIntensity = 'weather-intensity-high';
      else if (wLow.match(/слаб|легк|небольш|light/)) wIntensity = 'weather-intensity-low';
    } else if (wLow.match(/дожд|лив|rain|морос|drizzle/)) {
      wClass = 'weather-rain';
      if (wLow.match(/лив|сильн|проливн|heavy|бур/)) wIntensity = 'weather-intensity-high';
      else if (wLow.match(/морос|drizzle|слаб|легк|light|мелк/)) wIntensity = 'weather-intensity-low';
    } else if (wLow.match(/облач|пасмур|cloud|overcast/)) {
      wClass = 'weather-cloudy';
    } else if (wLow.match(/ветер|ветр|wind|ураган|бур/)) {
      wClass = 'weather-wind';
      if (wLow.match(/сильн|штормов|порыв|strong|gust|ураган|бур/)) wIntensity = 'weather-intensity-high';
    } else if (wLow.match(/туман|fog|дымк/)) {
      wClass = 'weather-fog';
    } else if (wLow.match(/ясн|солнеч|clear|sunny/)) {
      wClass = 'weather-clear';
    }

    let tempClass = '', freezeClass = '', tempMatch = wRaw.match(/([-+\u2212]?\d+)/);
    if (tempMatch) {
      let tempStr = tempMatch[1].replace('\u2212', '-');
      let tempVal = parseInt(tempStr, 10);
      if (tempVal <= 0) tempClass = 'temp-cold';
      if (tempVal <= -10) freezeClass = 'temp-freezing'; 
      if (tempVal >= 20) tempClass = 'temp-hot temp-drops'; 
    }

    let seasonClass = '';
    let dLow = (dRaw + ' ' + wRaw + ' ' + tRaw).toLowerCase(); 
    if (dLow.match(/зим|декабр|январ|феврал|dec|jan|feb|\.12\.|\.01\.|\.02\.|снег|снеж|метел|вьюг|мороз|буран/)) seasonClass = 'season-winter';
    else if (dLow.match(/весн|март|апрел|май|mar|apr|may|\.03\.|\.04\.|\.05\./)) seasonClass = 'season-spring';
    else if (dLow.match(/лет|июн|июл|август|jun|jul|aug|\.06\.|\.07\.|\.08\./)) seasonClass = 'season-summer';
    else if (dLow.match(/осен|сентябр|октябр|ноябр|sep|oct|nov|\.09\.|\.10\.|\.11\./)) seasonClass = 'season-autumn';

    let dustyClass = (tempClass === 'temp-hot' && seasonClass === 'season-summer' && (wClass === 'weather-clear' || wClass === 'weather-wind')) ? 'weather-dusty' : '';
    let rainbowClass = (wClass === 'weather-clear' && (lastSceneWeather === 'weather-rain' || lastSceneWeather === 'weather-storm')) ? 'weather-rainbow' : '';
    if (wRaw) lastSceneWeather = wClass;

    let dewActive = phaseClass === 'phase-morning' && (wClass === 'weather-clear' || wClass === 'weather-cloudy') && (seasonClass === 'season-spring' || seasonClass === 'season-summer');

    let celestialStyle = '', sunVarsStyle = '';
    if (hourMatch) {
      let hh = parseInt(hourMatch[1], 10), mmMatch = tRaw.match(/\d{1,2}:(\d{2})/), mm = mmMatch ? parseInt(mmMatch[1], 10) : 0, minutesOfDay = hh * 60 + mm;
      const DAY_START = 6 * 60, DAY_END = 20 * 60; let p, cx, cy;
      if (minutesOfDay >= DAY_START && minutesOfDay <= DAY_END) p = (minutesOfDay - DAY_START) / (DAY_END - DAY_START);
      else p = (minutesOfDay > DAY_END ? (minutesOfDay - DAY_END) : (minutesOfDay + (1440 - DAY_END))) / (1440 - (DAY_END - DAY_START));
      cx = 6 + p * 84; cy = 76 - Math.sin(p * Math.PI) * 60;
      celestialStyle = ` style="--cel-x:${cx.toFixed(1)}%;--cel-y:${cy.toFixed(1)}%;"`;
      sunVarsStyle = ` style="--sun-h:${p.toFixed(3)};--sun-alt:${Math.max(0, Math.sin(p * Math.PI)).toFixed(3)};"`;
    }

    if (Object.keys(data.scene).length > 0) {
      let subTags = [];
      if (tRaw) subTags.push(`<span class="hud-preview-tag">🕒 ${escapeHtml(tRaw.split('|')[0].trim())}</span>`);
      if (wRaw) subTags.push(`<span class="hud-preview-tag">🌤️ ${escapeHtml(wRaw)}</span>`);
      if (dRaw) subTags.push(`<span class="hud-preview-tag">📅 ${escapeHtml(dRaw)}</span>`);
      osSubtitleHtml = `<div class="hud-os-subtitle">${subTags.join('')}</div>`;
    }

    // МЕГА-ПАНЕЛЬ НАСТРОЕК С НОВЫМИ ШРИФТАМИ И ВЕРТИКАЛЬНОЙ СЕТКОЙ
    let html = `<div class="hud-os-card no-swipe">
      <input type="checkbox" class="hud-toggle-input" id="os-toggle-${baseId}">
      <label class="hud-os-topbar" for="os-toggle-${baseId}">
        <div class="hud-os-topbar-left"><span class="hud-os-logo">TavernOS</span>${osSubtitleHtml}</div>
        <div class="hud-os-topbar-right">
            <span class="hud-theme-btn" title="Настроить цвета темы">🎨</span>
            <span class="hud-regen-btn" title="Перегенерировать только HUD">🔄</span>
            <span class="hud-toggle-indicator">▼</span>
        </div>
      </label>
      <div class="hud-theme-panel" id="theme-panel-${baseId}">
        <details><summary>🎨 Общие цвета & Фоны</summary>
          <div class="hud-theme-grid">
            <div class="hud-theme-row"><label>Акцент:</label> <input type="color" class="hud-theme-color-input" data-key="accentColor" value="${settings.accentColor}"></div>
            <div class="hud-theme-row"><label>Свечение:</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="glowColor" value="${settings.glowColor}"><input type="range" class="hud-theme-range-input" data-key="glowAlpha" min="0" max="100" value="${settings.glowAlpha}"></div></div>
            <div class="hud-theme-row"><label>Фон (Старт):</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="cardBgStart" value="${settings.cardBgStart}"><input type="range" class="hud-theme-range-input" data-key="cardBgAlpha" min="0" max="100" value="${settings.cardBgAlpha}"></div></div>
            <div class="hud-theme-row"><label>Фон (Конец):</label> <input type="color" class="hud-theme-color-input" data-key="cardBgEnd" value="${settings.cardBgEnd}"></div>

            <!-- БЛОК БЛЮРА И ВСТРОЕННОГО "РЕДАКТОРА" ФОНА -->
            <div class="hud-theme-row"><label>Сила Блюра:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="backdropBlur" min="0" max="30" value="${settings.backdropBlur}"> <span style="font-size:0.8em;opacity:0.7">${settings.backdropBlur}px</span></div></div>
            <div class="hud-theme-row"><label>Прозрачность фона:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="bgOpacity" min="0" max="100" value="${settings.bgOpacity}"> <span style="font-size:0.8em;opacity:0.7">${settings.bgOpacity}%</span></div></div>
            <div class="hud-theme-row"><label>Масштаб картинки:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="bgScale" min="50" max="200" value="${settings.bgScale}"> <span style="font-size:0.8em;opacity:0.7">${settings.bgScale}%</span></div></div>
            <div class="hud-theme-row"><label>Сдвиг (Вверх-Вниз):</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="bgOffsetY" min="0" max="100" value="${settings.bgOffsetY}"> <span style="font-size:0.8em;opacity:0.7">${settings.bgOffsetY}%</span></div></div>
            
            <div class="hud-theme-row"><label>Фон (Картинка):</label> 
              <div class="hud-theme-flex">
                <input type="text" class="hud-theme-text-input" data-key="bgImage" value="${settings.bgImage}" placeholder="URL..." style="width: 80px; background: rgba(0,0,0,0.5); color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 4px; font-size: 0.9em;">
                <button type="button" class="hud-bg-upload-btn" title="Загрузить из галереи" style="cursor:pointer; background:var(--hud-accent); color:#fff; border:none; border-radius:4px; padding:2px 6px; font-size:1.1em; outline:none;">📁</button>
                <input type="file" class="hud-bg-upload-file" accept="image/*" style="display:none;">
              </div>
            </div>
            <!-- КОНЕЦ НОВОГО БЛОКА -->
            
            <div class="hud-theme-row"><label>Инфоблок (Старт):</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="infoBlockBgStart" value="${settings.infoBlockBgStart}"><input type="range" class="hud-theme-range-input" data-key="infoBlockBgAlpha" min="0" max="100" value="${settings.infoBlockBgAlpha}"></div></div>
            <div class="hud-theme-row"><label>Инфоблок (Конец):</label> <input type="color" class="hud-theme-color-input" data-key="infoBlockBgEnd" value="${settings.infoBlockBgEnd}"></div>
          </div>
        </details>
        <details><summary>🧠 Память</summary>
          <div class="hud-theme-grid">
            <div class="hud-theme-row"><label>Фон (Старт):</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="memoryBgStart" value="${settings.memoryBgStart}"><input type="range" class="hud-theme-range-input" data-key="memoryBgAlpha" min="0" max="100" value="${settings.memoryBgAlpha}"></div></div>
            <div class="hud-theme-row"><label>Фон (Конец):</label> <input type="color" class="hud-theme-color-input" data-key="memoryBgEnd" value="${settings.memoryBgEnd}"></div>
            <div class="hud-theme-row"><label>Акцент:</label> <input type="color" class="hud-theme-color-input" data-key="memoryAccent" value="${settings.memoryAccent}"></div>
            <div class="hud-theme-row"><label>Свечение:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="memoryGlowAlpha" min="0" max="100" value="${settings.memoryGlowAlpha}"></div></div>
            <div class="hud-theme-row"><label>Блюр:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="memoryBlur" min="0" max="30" value="${settings.memoryBlur}"><span style="font-size:0.8em;opacity:0.7">${settings.memoryBlur}px</span></div></div>
          </div>
        </details>
        <details><summary>📱 Телефон — настройки темы</summary>
          <div class="hud-theme-grid">
            <div style="font-size:11px;opacity:.68;grid-column:1/-1;">Телефонный эмулятор сейчас отключён из HUD. Эти настройки сохранены отдельно и не влияют на остальные блоки.</div>
            <div class="hud-theme-row"><label>Фон (Старт):</label><div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="phoneBgStart" value="${settings.phoneBgStart}"><input type="range" class="hud-theme-range-input" data-key="phoneBgAlpha" min="0" max="100" value="${settings.phoneBgAlpha}"></div></div>
            <div class="hud-theme-row"><label>Фон (Конец):</label><input type="color" class="hud-theme-color-input" data-key="phoneBgEnd" value="${settings.phoneBgEnd}"></div>
            <div class="hud-theme-row"><label>Входящие сообщения:</label><div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="msgInBg" value="${settings.msgInBg}"><input type="range" class="hud-theme-range-input" data-key="msgInAlpha" min="0" max="100" value="${settings.msgInAlpha}"></div></div>
            <div class="hud-theme-row"><label>Исходящие сообщения:</label><div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="msgOutStart" value="${settings.msgOutStart}"><input type="color" class="hud-theme-color-input" data-key="msgOutEnd" value="${settings.msgOutEnd}"><input type="range" class="hud-theme-range-input" data-key="msgOutAlpha" min="0" max="100" value="${settings.msgOutAlpha}"></div></div>
            <div class="hud-theme-row"><label>Обои телефона:</label><input type="text" class="hud-theme-text-input" data-key="phoneWallpaper" value="${settings.phoneWallpaper}" placeholder="URL или data:image/..." style="width:100%;background:rgba(0,0,0,.5);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:4px;padding:3px 5px;"></div>
            <div class="hud-theme-row"><label>Блюр обоев:</label><input type="range" class="hud-theme-range-input" data-key="phoneWallpaperBlur" min="0" max="30" value="${settings.phoneWallpaperBlur}"></div>
            <div class="hud-theme-row"><label>Прозрачность обоев:</label><input type="range" class="hud-theme-range-input" data-key="phoneWallpaperOpacity" min="0" max="100" value="${settings.phoneWallpaperOpacity}"></div>
          </div>
        </details>
        <details><summary>🗂️ Верхние плашки & Табы</summary>
          <div class="hud-theme-grid">
            <div class="hud-theme-row"><label>Верхняя панель:</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="topBarBg" value="${settings.topBarBg}"><input type="range" class="hud-theme-range-input" data-key="topBarAlpha" min="0" max="100" value="${settings.topBarAlpha}"></div></div>
            <div class="hud-theme-row"><label>Фон вкладок (Табы):</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="tabsBg" value="${settings.tabsBg}"><input type="range" class="hud-theme-range-input" data-key="tabsAlpha" min="0" max="100" value="${settings.tabsAlpha}"></div></div>
          </div>
        </details>
        <details><summary>🌤️ Виджет погоды</summary>
          <div class="hud-theme-grid">
            <div class="hud-theme-row"><label>Оверлей (Оттенок):</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="sceneOverlayColor" value="${settings.sceneOverlayColor}"><input type="range" class="hud-theme-range-input" data-key="sceneOverlayAlpha" min="0" max="100" value="${settings.sceneOverlayAlpha}"></div></div>
            <div class="hud-theme-row"><label>Цвет текста:</label> <input type="color" class="hud-theme-color-input" data-key="sceneTextColor" value="${settings.sceneTextColor}"></div>
            <div class="hud-theme-row"><label>Фон плашек:</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="weatherBgColor" value="${settings.weatherBgColor}"><input type="range" class="hud-theme-range-input" data-key="weatherBgAlpha" min="0" max="100" value="${settings.weatherBgAlpha}"></div></div>
            <div class="hud-theme-row"><label>Блюр плашек:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="weatherBlur" min="0" max="30" value="${settings.weatherBlur}"> <span style="font-size:0.8em;opacity:0.7">${settings.weatherBlur}px</span></div></div>
          </div>
        </details>
        <details><summary>📡 Перехваты</summary>
          <div class="hud-theme-grid">
            <div class="hud-theme-row"><label>Цвет Перехвата:</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="interceptColor" value="${settings.interceptColor}"><input type="range" class="hud-theme-range-input" data-key="interceptBgAlpha" min="0" max="100" value="${settings.interceptBgAlpha}"></div></div>
            <div class="hud-theme-row"><label>Бейдж уведомл.:</label> <input type="color" class="hud-theme-color-input" data-key="badgeColor" value="${settings.badgeColor}"></div>
          </div>
        </details>
        <details><summary>⚠️ Драма & NSFW</summary>
          <div class="hud-theme-grid">
            <div class="hud-theme-row"><label>Цвет Драмы:</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="dramaColor" value="${settings.dramaColor}"><input type="range" class="hud-theme-range-input" data-key="dramaBgAlpha" min="0" max="100" value="${settings.dramaBgAlpha}"></div></div>
            <div class="hud-theme-row"><label>Цвет NSFW:</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="nsfwColor" value="${settings.nsfwColor}"><input type="range" class="hud-theme-range-input" data-key="nsfwBgAlpha" min="0" max="100" value="${settings.nsfwBgAlpha}"></div></div>
          </div>
        </details>
        <details><summary>✍️ Шрифты & Размеры</summary>
          <div class="hud-theme-grid">
            <div class="hud-theme-row"><label>Цвет часов:</label> <input type="color" class="hud-theme-color-input" data-key="clockColor" value="${settings.clockColor}"></div>
            <div class="hud-theme-row"><label>Шрифт часов:</label>
              <select class="hud-theme-select-input" data-key="fontClock">${makeFontOptions(settings.fontClock)}</select>
            </div>
            <div class="hud-theme-row"><label>Размер часов:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="fontSizeClock" min="20" max="60" value="${settings.fontSizeClock}"> <span style="font-size:0.8em;opacity:0.7">${settings.fontSizeClock}px</span></div></div>
            
            <div class="hud-theme-row"><label>Основной шрифт:</label>
              <select class="hud-theme-select-input" data-key="fontMain">${makeFontOptions(settings.fontMain)}</select>
            </div>
            <div class="hud-theme-row"><label>Размер текста:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="fontSizeMain" min="10" max="22" value="${settings.fontSizeMain}"> <span style="font-size:0.8em;opacity:0.7">${settings.fontSizeMain}px</span></div></div>
            
            <div class="hud-theme-row"><label>Шрифт заголовков:</label>
              <select class="hud-theme-select-input" data-key="fontHeaders">${makeFontOptions(settings.fontHeaders)}</select>
            </div>
            <div class="hud-theme-row"><label>Размер заголовков:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="fontSizeHeaders" min="10" max="20" value="${settings.fontSizeHeaders}"> <span style="font-size:0.8em;opacity:0.7">${settings.fontSizeHeaders}px</span></div></div>
            
            <div class="hud-theme-row"><label>Шрифт Дневника:</label>
              <select class="hud-theme-select-input" data-key="fontDiary">${makeFontOptions(settings.fontDiary)}</select>
            </div>
          </div>
		  <div class="hud-theme-row"><label>Размер Дневника:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="fontSizeDiary" min="12" max="30" value="${settings.fontSizeDiary}"> <span style="font-size:0.8em;opacity:0.7">${settings.fontSizeDiary}px</span></div></div>
        </details>
      </div>
      <div class="hud-os-wrapper">`;

    if (Object.keys(data.scene).length > 0) {
      let tParts = tRaw.split('|').map(s => s.trim());
      let timeHHMM = tParts[0] || '--:--';
      let timePhase = tParts.length > 1 ? tParts[1].toUpperCase() : '';
      let timeDisplay = escapeHtml(timeHHMM).replace(':', '<span class="hud-time-colon">:</span>');
       
      let dateStr = escapeHtml(dRaw);
      if (dateStr && timePhase) dateStr += ` • ${timePhase}`;
      else if (!dateStr && timePhase) dateStr = timePhase;

      let atmStr = data.scene['Атмосфера'] ? `«${escapeHtml(data.scene['Атмосфера'])}»` : '';

      let stars = '';
      const starDot = (cls, l, t, sz, dur, delay) => `<span class="hud-star2 dot ${cls}" style="left:${l}%;top:${t}%;width:${sz}px;height:${sz}px;animation-duration:${dur}s;animation-delay:${delay}s;"></span>`;
      const starDiamond = (cls, l, t, sz, dur, delay) => `<span class="hud-star2 diamond ${cls}" style="left:${l}%;top:${t}%;width:${sz}px;height:${sz}px;animation-duration:${dur}s;animation-delay:${delay}s;"></span>`;
      stars += starDot('', 12, 22, 2, 2.2, 0);
      stars += starDiamond('', 24, 12, 3, 2.6, 0.4);
      stars += starDot('', 38, 30, 2, 1.9, 0.9);
      stars += starDot('', 50, 10, 2.4, 2.4, 0.2);
      stars += starDiamond('', 62, 26, 3, 3, 1.2);
      stars += starDot('', 74, 14, 2, 2.1, 0.6);
      stars += starDot('', 84, 32, 2.6, 2.8, 1.5);
      stars += starDiamond('', 92, 20, 2.5, 2.3, 0.3);
      stars += starDot('', 6, 38, 1.8, 2, 1.8);

      let fireflies = '';
      for (let i = 1; i <= 6; i++) fireflies += `<span class="hud-firefly ff${i}"></span>`;

      html += `
      <div class="hud-scene-widget ${phaseClass} ${wClass} ${wIntensity} ${tempClass} ${freezeClass} ${seasonClass} ${dustyClass} ${rainbowClass}" title="Нажмите для анимации">
        <div class="hud-fx-bg"></div>
        <div class="hud-fx-stars">${stars}</div>
        <div class="hud-fx-fireflies">${fireflies}</div>
        <div class="hud-fx-storm-flash"></div>
        <div class="hud-fx-lightning">${buildLightningSvg()}</div>
        <div class="hud-fx-rainbow"></div>
        <div class="hud-fx-celestial"${celestialStyle}></div>
        <div class="hud-fx-cloud-cover"></div>
        <div class="hud-fx-season-scene"${sunVarsStyle}>${buildSeasonSceneHtml(seasonClass, { dew: dewActive, deepFreeze: !!freezeClass })}</div>
        <div class="hud-fx-weather"></div>
        <div class="hud-fx-frost"></div>
        <div class="hud-fx-temp"></div>
        <div class="hud-fx-overlay"></div>
        <div class="hud-scene-top">
          <div class="hud-scene-time-group">
            <div class="hud-time-display">${timeDisplay}</div>
            ${dateStr ? `<div class="hud-date-display">${dateStr}</div>` : ''}
          </div>
          <div class="hud-scene-weather-group">
            ${data.scene['Погода'] ? `<div class="hud-weather-item">${escapeHtml(data.scene['Погода'])}</div>` : ''}
            ${data.scene['Настроение'] ? `<div class="hud-mood-item">${escapeHtml(data.scene['Настроение'])}</div>` : ''}
          </div>
        </div>
        ${atmStr ? `<div class="hud-scene-atm">${atmStr}</div>` : ''}
      </div>`;
    }
     
    html += `<div class="hud-tabs-header">`;

    let tabsHtml = '', contentHtml = '', isFirst = true;

    data.characters.forEach((char, index) => {
      const uid = `char-${index}-${baseId}`;
      const name = char['Имя'] || `NPC ${index+1}`;
      tabsHtml += `<div class="hud-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">👤 ${escapeHtml(name.split(' ')[0])}</div>`;
      contentHtml += buildCharacterHTML(char, uid, isFirst, index === 0);
      isFirst = false;
    });

    if (settings.enableUserBlock && data.user && Object.keys(data.user).length > 0) {
      const uid = `user-${baseId}`;
      const userTabHtml = buildUserHTML(data.user, uid, isFirst);
      if (userTabHtml) {
        const personaName = getSafeUserName();
        tabsHtml += `<div class="hud-tab hud-user-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">👤 ${escapeHtml(personaName.split(' ')[0])}</div>`;
        contentHtml += userTabHtml;
        isFirst = false;
      }
    }

    if (settings.enablePhone && data.chatsMap) {
      const uid = `phone-${baseId}`;
      tabsHtml += `<div class="hud-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">📱 Телефон</div>`;
      contentHtml += buildPhoneTabsHTML(data.chatsMap, uid, isFirst, getSafeUserName());
      isFirst = false;
    }

    // === ВСТАВЛЯЕМ ВКЛАДКУ ПАМЯТИ СЮДА ===
    if (settings.enableMemory && data.memory && (data.memory.timeline.length > 0 || data.memory.important.length > 0 || data.memory.secrets.length > 0 || (data.memory.mood && ((data.memory.mood.user && (data.memory.mood.user.current || data.memory.mood.user.history?.length)) || (data.memory.mood.char && (data.memory.mood.char.current || data.memory.mood.char.history?.length)))) || (data.memory.route && ((data.memory.route.user?.length || 0) > 0 || (data.memory.route.char?.length || 0) > 0)))) {
      const uid = `memory-${baseId}`;
      tabsHtml += `<div class="hud-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">🧠 Память</div>`;
      contentHtml += buildMemoryHTML(data.memory, uid, isFirst);
      isFirst = false;
    }


    if (data.intercepts && data.intercepts.length > 0 && settings.enableIntercepts) {
      const uid = `intercept-${baseId}`;
      tabsHtml += `<div class="hud-tab intercept-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">📡 Перехваты</div>`;
      contentHtml += buildInterceptsHTML(data.intercepts, uid, isFirst);
      isFirst = false;
    }

    if (data.diary.length > 0 && settings.enableDiary) {
      const uid = `diary-${baseId}`;
      tabsHtml += `<div class="hud-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">📖 Дневник</div>`;
      contentHtml += buildDiaryHTML(data.diary, uid, isFirst);
      isFirst = false;
    }

    if (data.dreams.length > 0 && settings.enableDreams) {
      const uid = `dream-${baseId}`;
      tabsHtml += `<div class="hud-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">🌙 Сны</div>`;
      contentHtml += buildDreamHTML(data.dreams, uid, isFirst);
      isFirst = false;
    }

    if (Object.values(data.world).some(arr => Array.isArray(arr) && arr.length > 0 && settings.enableWorld)) {
      const uid = `world-${baseId}`;
      tabsHtml += `<div class="hud-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">🌍 Мир</div>`;
      contentHtml += buildWorldHTML(data.world, uid, isFirst);
    }

    html += tabsHtml + `</div><div class="hud-tabs-body">` + contentHtml + `</div></div></div>`;
    return html;
  }

  function freezeOldHUDs() {
    const scope = cachedChatContainer || document;
    const allCards = scope.querySelectorAll('.hud-os-card');
    if (allCards.length > 0) {
      for (let i = 0; i < allCards.length - 1; i++) {
        if (allCards[i].dataset.userExpanded === 'true') continue; // пользователь сам раскрыл — не трогаем
        if (!allCards[i].classList.contains('hud-historical')) {
          allCards[i].classList.add('hud-historical');
          const checkbox = allCards[i].querySelector('.hud-toggle-input');
          if (checkbox) checkbox.checked = false; 
        }
      }
      allCards[allCards.length - 1].classList.remove('hud-historical');
    }
  }

  function maybeInjectMissingHudButton(messageElement, textElement) {
    if (messageElement.getAttribute('is_user') === 'true') return;
    if (messageElement.getAttribute('is_system') === 'true') return;

    if (textElement.querySelector('.hud-missing-placeholder')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'hud-missing-placeholder';
    wrapper.innerHTML = `<span class="hud-regen-btn hud-create-btn" title="В этом сообщении нет HUD-блока — сгенерировать и вшить с нуля">➕ Создать HUD</span>`;
    textElement.appendChild(wrapper);
    bindHudRegenButton(wrapper.querySelector('.hud-create-btn'));
  }

  function getHudChatContextSafe() {
    try {
      if (typeof window.SillyTavern !== 'undefined' && typeof window.SillyTavern.getContext === 'function') {
        return window.SillyTavern.getContext();
      }
      if (typeof getContext === 'function') return getContext();
      if (typeof window.getContext === 'function') return window.getContext();
    } catch (e) {
      console.debug('[TavernOS HUD] chat context unavailable during HUD recovery:', e);
    }
    return null;
  }

  function findChatMessageForElement(messageElement) {
    const id = messageElement?.getAttribute?.('mesid');
    if (id == null) return null;
    const ctx = getHudChatContextSafe();
    const chatData = ctx && Array.isArray(ctx.chat) ? ctx.chat : (Array.isArray(window.chat) ? window.chat : null);
    if (!chatData) return null;
    const numericId = parseInt(id, 10);
    const byMeta = chatData.find(m => String(m?._id) === String(id) || String(m?.mesId) === String(id));
    if (byMeta) return byMeta;
    return Number.isInteger(numericId) && numericId >= 0 && numericId < chatData.length ? chatData[numericId] : null;
  }

  function recoverHudFromActiveSwipe(messageElement, textElement) {
    if (!messageElement || !textElement) return false;
    const message = findChatMessageForElement(messageElement);
    if (!message || !Array.isArray(message.swipes) || message.swipe_id === undefined) return false;
    const activeIndex = Number(message.swipe_id);
    if (!Number.isInteger(activeIndex) || activeIndex < 0 || activeIndex >= message.swipes.length) return false;
    const activeSwipe = message.swipes[activeIndex];
    if (typeof activeSwipe !== 'string') return false;
    const hudBlock = extractHudBlock(activeSwipe);
    if (!hudBlock || !/(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)/i.test(hudBlock)) return false;

    // ST иногда после saveReply держит HUD в swipes[current] раньше, чем он
    // попадает в message.mes/DOM. Восстанавливаем только отображаемый текст:
    // саму механику вставки/обновления HUD не меняем.
    const currentHtml = textElement.innerHTML || '';
    if (/(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)/i.test(currentHtml)) return false;

    const node = document.createTextNode('\n\n' + hudBlock);
    textElement.appendChild(node);
    console.debug('[TavernOS HUD] Recovered HUD from active swipe', {
      swipeId: activeIndex,
      messageId: messageElement.getAttribute('mesid')
    });
    return true;
  }

  async function processMessage(messageElement) {
    const _mesid = messageElement.getAttribute('mesid');
    const textElement = messageElement.querySelector('.mes_text');
    if (!textElement) { return; }

    const stalePlaceholder = textElement.querySelector('.hud-missing-placeholder');
    if (stalePlaceholder) stalePlaceholder.remove();

    let innerHtml = textElement.innerHTML;

    // Если карточка уже есть и исходного [HUD] в DOM больше нет — всё уже обработано.
    // Если ST снова дорисовал исходный [HUD] рядом с карточкой, НЕ выходим:
    // нормализатор ниже должен удалить сырой блок и оставить одну карточку.
    const hasRenderedCard = innerHtml.includes('hud-os-card');
    const hasRawHudSource = /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)/i.test(innerHtml);
    if (hasRenderedCard && !hasRawHudSource) return;

    // Recovery path for ST swipe/save timing:
    if (!/(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)/i.test(innerHtml)) {
      if (recoverHudFromActiveSwipe(messageElement, textElement)) {
        innerHtml = textElement.innerHTML;
      }
    }

    const openTagRegex = /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)/i;
    const closeTagRegex = /(?:\[|&lt;|<|&#91;)\s*(?:\/|&#47;|\\)\s*HUD\s*(?:\]|&gt;|>|&#93;)/i;

    if (!openTagRegex.test(innerHtml)) {
      maybeInjectMissingHudButton(messageElement, textElement);
      return;
    }

    const [lastMes, secondLastMes] = getLastTwoMes();
    const isLastMes = messageElement === lastMes || messageElement === secondLastMes;
    const hasCloseTag = closeTagRegex.test(innerHtml);

    const extractRegex = /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)([\s\S]*?)(?:(?:\[|&lt;|<|&#91;)\s*(?:\/|&#47;|\\)\s*HUD\s*(?:\]|&gt;|>|&#93;)|$)/ig;
    const hudBlocks = [];
    let hudMatch;
    while ((hudMatch = extractRegex.exec(innerHtml)) !== null) {
      hudBlocks.push({
        full: hudMatch[0],
        content: hudMatch[1] || '',
        index: hudMatch.index,
      });
      if (hudMatch[0] === '') extractRegex.lastIndex++;
    }

    const parsedHudBlocks = [];
    for (let index = 0; index < hudBlocks.length; index++) {
      const block = hudBlocks[index];
      try {
        const data = parseHUDComplex(block.content);
        parsedHudBlocks.push({
          index,
          data,
          score: scoreHudJsonCandidate(data),
        });
      } catch (e) {
        console.debug('[TavernOS HUD] HUD block candidate failed', {
          blockIndex: index,
          error: e?.message || String(e),
        });
      }
    }

    let hasChanges = false;
    let newHtml = innerHtml;
    let rendered = '';
    if (parsedHudBlocks.length) {
      parsedHudBlocks.sort((a, b) => b.score - a.score || a.index - b.index);
      const selected = parsedHudBlocks[0];
      rendered = renderHUD(selected.data);

      if (rendered) {
        for (let i = hudBlocks.length - 1; i >= 0; i--) {
          const block = hudBlocks[i];
          const replacement = i === selected.index ? rendered : '';
          newHtml = newHtml.slice(0, block.index) + replacement + newHtml.slice(block.index + block.full.length);
        }
        hasChanges = newHtml !== innerHtml;

        setHudRepairDiagnostic({
          ...(window.__tavernOSHudRepairDiagnostic || {}),
          multiHudBlocks: hudBlocks.length,
          parsedHudBlocks: parsedHudBlocks.length,
          selectedHudBlock: selected.index,
          selectedHudScore: selected.score,
        });
      }
    }

    if (hasChanges) {
      const normalized = normalizeHudDisplayDom(messageElement, textElement, rendered);
      if (!normalized) textElement.innerHTML = newHtml;
      textElement.querySelectorAll('.hud-regen-btn').forEach(bindHudRegenButton);
      freezeOldHUDs();

      if (hasCloseTag || !isLastMes || hudBlocks.length > 1) {
        messageElement.dataset.hudProcessed = 'true';
      }

      setHudRepairDiagnostic({
        ...(window.__tavernOSHudRepairDiagnostic || {}),
        displayNormalized: normalized,
        displayHudCards: textElement.querySelectorAll('.hud-os-card').length,
      });
    }

    textElement.querySelectorAll('.hud-regen-btn').forEach(bindHudRegenButton);

    textElement.querySelectorAll('.hud-os-card').forEach(card => {
        if (!card.dataset.touchFixed) {
            card.addEventListener('touchstart', e => e.stopPropagation(), {passive: true});
            card.addEventListener('touchmove', e => e.stopPropagation(), {passive: true});
            card.addEventListener('touchend', e => e.stopPropagation(), {passive: true});
            card.dataset.touchFixed = 'true';
        }

        // Tab bars need their own guard so horizontal swipes scroll the HUD tabs
        // instead of being interpreted by SillyTavern as a message swipe.
        card.querySelectorAll('.hud-tabs-header, .hud-phone-subtabs').forEach(bar => {
            if (bar.dataset.swipeGuardBound === 'true') return;
            ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(type => {
                bar.addEventListener(type, e => e.stopPropagation(), { passive: true });
            });
            bar.dataset.swipeGuardBound = 'true';
        });
    });
  }

  // Remove duplicate HUD cards/raw HUD markup from the *displayed DOM only*.
  // The saved message/swipe data is intentionally untouched. This is a safety
  // net for ST re-renders where the same active swipe can briefly be painted
  // twice (or once as a rendered card and once as the original fenced JSON).
  function normalizeHudDisplayDom(messageElement, textElement, renderedHtml) {
    if (!messageElement || !textElement) return false;

    // A previous pass may already have produced a card while ST subsequently
    // restored the source HUD text. Remove cards from this message first, then
    // paint exactly one fresh card at the source HUD position. Other messages
    // are untouched.
    textElement.querySelectorAll('.hud-os-card').forEach(card => card.remove());

    let html = textElement.innerHTML || '';
    const hudRegex = /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)[\s\S]*?(?:(?:\[|&lt;|<|&#91;)\s*(?:\/|&#47;|\\)\s*HUD\s*(?:\]|&gt;|>|&#93;)|$)/ig;
    const matches = [];
    let m;
    while ((m = hudRegex.exec(html)) !== null) {
      matches.push({ index: m.index, length: m[0].length });
      if (m[0] === '') hudRegex.lastIndex++;
    }

    // If the HTML-level regex sees raw HUD blocks, replace ALL of them with
    // exactly one rendered card. This is deliberately independent of parsing
    // and therefore also cleans up a malformed/duplicate second block.
    if (matches.length) {
      let out = html;
      for (let i = matches.length - 1; i >= 0; i--) {
        const r = matches[i];
        out = out.slice(0, r.index) + (i === 0 ? renderedHtml : '') + out.slice(r.index + r.length);
      }
      if (out !== html) {
        textElement.innerHTML = out;
        return true;
      }
    }

    // If the raw HUD survived because a markdown/highlight renderer split the
    // markers across DOM text nodes, use a DOM Range fallback. It removes the
    // entire marker-to-marker region without touching surrounding prose.
    const walker = document.createTreeWalker(textElement, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);

    const flat = [];
    for (const n of nodes) {
      const value = n.nodeValue || '';
      flat.push({ node: n, start: flat.length ? flat[flat.length - 1].end : 0, end: (flat.length ? flat[flat.length - 1].end : 0) + value.length });
    }
    const fullText = flat.map(x => x.node.nodeValue || '').join('');
    const open = /(?:\[|<)\s*HUD\s*(?:\]|>)/i;
    const close = /(?:\[|<)\s*\/\s*HUD\s*(?:\]|>)/i;
    const openMatch = fullText.match(open);
    if (openMatch) {
      const closeMatch = fullText.match(close);
      if (closeMatch && closeMatch.index >= openMatch.index) {
        const startPos = openMatch.index;
        const endPos = closeMatch.index + closeMatch[0].length;
        const locate = (pos) => flat.find(x => pos >= x.start && pos <= x.end) || flat[flat.length - 1];
        const a = locate(startPos);
        const b = locate(endPos);
        if (a && b) {
          const range = document.createRange();
          range.setStart(a.node, Math.max(0, startPos - a.start));
          range.setEnd(b.node, Math.max(0, endPos - b.start));
          range.deleteContents();
          const holder = document.createElement('div');
          holder.innerHTML = renderedHtml;
          const frag = document.createDocumentFragment();
          while (holder.firstChild) frag.appendChild(holder.firstChild);
          range.insertNode(frag);
          return true;
        }
      }
    }

    return false;
  }

  // SillyTavern uses .edit_textarea while a message is being edited.
  // TavernOS must not touch the message DOM during editing, otherwise its
  // normal HUD re-render can overwrite the editor contents.
  function isMessageBeingEdited(messageElement) {
    if (!messageElement) return false;
    return !!messageElement.querySelector(
      '.edit_textarea, textarea#curEditTextarea, .mes_edit_textarea'
    );
  }

  const PERFORMANCE_MESSAGE_THRESHOLD = 200;
  const PERFORMANCE_ACTIVE_WINDOW = 80;
  let performanceIntersectionObserver = null;
  let performanceScrollRaf = 0;

  function isPerformanceModeActive(container = cachedChatContainer) {
    if (!settings.performanceMode || !container) return false;
    return container.querySelectorAll('.mes').length >= PERFORMANCE_MESSAGE_THRESHOLD;
  }

  function updatePerformanceMode() {
    const container = cachedChatContainer || document.querySelector('#chat') || document.querySelector('#chat-container');
    if (!container) return false;
    const active = isPerformanceModeActive(container);
    container.classList.toggle('hud-performance-mode', active);
    if (!active) {
      container.querySelectorAll('.mes.hud-perf-older, .mes.hud-perf-visible').forEach(el => {
        el.classList.remove('hud-perf-older', 'hud-perf-visible');
      });
    }
    return active;
  }

  function refreshPerformanceMessageClasses() {
    const container = cachedChatContainer;
    if (!container || !isPerformanceModeActive(container)) return;
    const messages = Array.from(container.querySelectorAll('.mes'));
    const start = Math.max(0, messages.length - PERFORMANCE_ACTIVE_WINDOW);
    messages.forEach((mes, index) => {
      if (index < start && !mes.classList.contains('hud-perf-visible')) mes.classList.add('hud-perf-older');
      else mes.classList.remove('hud-perf-older');
    });
  }

  function setupPerformanceObserver() {
    const container = cachedChatContainer;
    if (!container) return;
    if (performanceIntersectionObserver) performanceIntersectionObserver.disconnect();
    performanceIntersectionObserver = null;
    if (!isPerformanceModeActive(container) || typeof IntersectionObserver === 'undefined') return;

    performanceIntersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const mes = entry.target;
        if (!mes.isConnected) continue;
        if (entry.isIntersecting) {
          mes.classList.add('hud-perf-visible');
          mes.classList.remove('hud-perf-older');
          safeProcessMessage(mes);
        } else {
          mes.classList.remove('hud-perf-visible');
          if (isPerformanceModeActive(container)) mes.classList.add('hud-perf-older');
        }
      }
    }, { root: null, rootMargin: '900px 0px', threshold: 0.01 });

    container.querySelectorAll('.mes').forEach(mes => performanceIntersectionObserver.observe(mes));
    refreshPerformanceMessageClasses();
  }

  function schedulePerformanceRefresh() {
    if (performanceScrollRaf) return;
    performanceScrollRaf = requestAnimationFrame(() => {
      performanceScrollRaf = 0;
      const wasActive = cachedChatContainer?.classList.contains('hud-performance-mode');
      const active = updatePerformanceMode();
      if (active && !wasActive) setupPerformanceObserver();
      if (!active && wasActive && performanceIntersectionObserver) {
        performanceIntersectionObserver.disconnect();
        performanceIntersectionObserver = null;
      }
    });
  }

  function processAllMessages() {
    const container = cachedChatContainer || document.querySelector('#chat') || document.querySelector('#chat-container');
    if (!container) return;
    const messages = Array.from(container.querySelectorAll('.mes'));
    const performanceActive = isPerformanceModeActive(container);
    if (performanceActive) {
      // На старте длинного чата рендерим только последние сообщения. Старые HUD
      // будут обработаны автоматически, когда попадут в область видимости.
      messages.slice(-PERFORMANCE_ACTIVE_WINDOW).forEach(el => safeProcessMessage(el));
      refreshPerformanceMessageClasses();
      setupPerformanceObserver();
    } else {
      messages.forEach(el => safeProcessMessage(el));
    }
  }

  const processingMessages = new WeakSet();
  function safeProcessMessage(messageElement) {
    if (!messageElement || isMessageBeingEdited(messageElement) || processingMessages.has(messageElement)) return;
    processingMessages.add(messageElement);
    Promise.resolve(processMessage(messageElement))
      .catch(error => console.error('HUD Manager: processMessage failed', error))
      .finally(() => processingMessages.delete(messageElement));
  }

  function replaceHudBlockInText(source, newHudText) {
    if (typeof source !== 'string') return source;
    const hudRegex = /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)[\s\S]*?(?:(?:\[|&lt;|<|&#91;)\s*(?:\/|&#47;|\\)\s*HUD\s*(?:\]|&gt;|>|&#93;)|$)/i;
    if (hudRegex.test(source)) return source.replace(hudRegex, newHudText);
    return source.trimEnd() + '\n\n' + newHudText;
  }

  function updateMessageDataForCurrentSwipe(message, newText) {
    message.mes = newText;
    if (Array.isArray(message.swipes) && message.swipe_id !== undefined) {
      message.swipes[message.swipe_id] = newText;
    }

    // SillyTavern/другие расширения могут рендерить extra.display_text вместо message.mes.
    // Если display_text уже содержит HUD — заменяем только его.
    // Если HUD создаётся впервые, добавляем его к сохранённому display_text,
    // чтобы updateMessageBlock() не вернул старую версию без HUD.
    if (message.extra && typeof message.extra.display_text === 'string') {
      const displayText = message.extra.display_text;
      const hudRegex = /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)/i;
      const newHud = extractHudBlock(newText);

      if (hudRegex.test(displayText)) {
        message.extra.display_text = replaceHudBlockInText(displayText, newHud);
      } else if (newHud && hudRegex.test(newHud)) {
        message.extra.display_text = displayText.trimEnd() + '\n\n' + newHud;
      }
    }
  }

  function extractHudBlock(text) {
    if (typeof text !== 'string') return '';
    const match = text.match(/(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)[\s\S]*?(?:(?:\[|&lt;|<|&#91;)\s*(?:\/|&#47;|\\)\s*HUD\s*(?:\]|&gt;|>|&#93;)|$)/i);
    return match ? match[0] : text;
  }

  function getMessageUpdateFunction(stContext) {
    if (stContext && typeof stContext.updateMessageBlock === 'function') {
      return stContext.updateMessageBlock.bind(stContext);
    }
    if (typeof updateMessageBlock === 'function') return updateMessageBlock;
    if (typeof window.updateMessageBlock === 'function') return window.updateMessageBlock;
    return null;
  }

  async function readHudApiError(response) {
    let payload = null;
    let raw = '';
    try { raw = await response.text(); } catch (_) {}
    if (raw) {
      try { payload = JSON.parse(raw); } catch (_) { payload = null; }
    }
    const message = payload?.error?.message || payload?.message || payload?.error || (typeof payload === 'string' ? payload : '') || raw;
    const clean = String(message || '').replace(/\s+/g, ' ').trim();
    const safe = clean.length > 500 ? clean.slice(0, 500) + '…' : clean;
    const info = { status: response.status, statusText: response.statusText || '', message: safe || `HTTP ${response.status}` };
    window.__tavernOSLastHudApiError = { ...info, timestamp: Date.now() };
    return info;
  }

  async function handleHudRegenButton(regenBtn) {
    if (!regenBtn) return;
    if (regenBtn.classList.contains('hud-spinning')) return;

        const isCreateBtn = regenBtn.classList.contains('hud-create-btn');
        const originalBtnContent = regenBtn.innerHTML;
        
        regenBtn.innerHTML = isCreateBtn 
            ? `<div style="display:flex; align-items:center; gap:6px;"><div class="hud-stars"><svg class="hud-star" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg><svg class="hud-star" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg><svg class="hud-star" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg></div> Создаю...</div>`
            : `<div class="hud-stars"><svg class="hud-star" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg><svg class="hud-star" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg><svg class="hud-star" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg></div>`;
        regenBtn.classList.add('hud-spinning');

        let loadingToast = showHudToast('loading', 'Загрузка', 'HUD генерируется. Подождите.');
        let mesEl = regenBtn.closest('.mes');

        try {
            const mesId = mesEl.getAttribute('mesid');
            const textElement = mesEl.querySelector('.mes_text');
            const extractRegex = /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)([\s\S]*?)(?:(?:\[|&lt;|<|&#91;)\s*(?:\/|&#47;|\\)\s*HUD\s*(?:\]|&gt;|>|&#93;)|$)/ig;
            
            let stContext = null;
            if (typeof window.SillyTavern !== 'undefined' && typeof window.SillyTavern.getContext === 'function') {
                stContext = window.SillyTavern.getContext();
            } else if (typeof getContext === 'function') {
                stContext = getContext();
            } else if (typeof window.getContext === 'function') {
                stContext = window.getContext();
            }

            let chatData = null;
            if (stContext && Array.isArray(stContext.chat)) {
                chatData = stContext.chat;
            } else if (typeof chat !== 'undefined' && Array.isArray(chat)) {
                chatData = chat;
            } else if (typeof window.chat !== 'undefined' && Array.isArray(window.chat)) {
                chatData = window.chat;
            }

            let targetMessage = null;
            let mesIdNum = parseInt(mesId, 10);
            
            if (chatData) {
                let foundIndex = chatData.findIndex(m => String(m._id) === String(mesId) || String(m.mesId) === String(mesId));
                if (foundIndex !== -1) {
                    mesIdNum = foundIndex;
                    targetMessage = chatData[foundIndex];
                } else if (!isNaN(mesIdNum) && mesIdNum >= 0 && mesIdNum < chatData.length) {
                    targetMessage = chatData[mesIdNum];
                }
            }

            if (!targetMessage) throw new Error('Не найдено сообщение в chat[].');

            let oldText = '';
            if (targetMessage) {
                if (targetMessage.swipes && targetMessage.swipe_id !== undefined && targetMessage.swipes[targetMessage.swipe_id]) {
                    oldText = targetMessage.swipes[targetMessage.swipe_id];
                } else {
                    oldText = targetMessage.mes || '';
                }
            }
            oldText = oldText.replace(extractRegex, '').trim();

            // Для старых сообщений в текущей вкладке может не существовать lastTavernRequest.
            // В таком случае берём живые настройки Chat Completion из ST вместо обращения
            // к несуществующим переменным currentModel/currentSource/etc.
            const liveOpenAISettings =
                (typeof window !== 'undefined' && window.oai_settings && typeof window.oai_settings === 'object')
                    ? window.oai_settings
                    : {};
            const liveChatCompletionSettings =
                (stContext && stContext.chatCompletionSettings && typeof stContext.chatCompletionSettings === 'object')
                    ? stContext.chatCompletionSettings
                    : {};
            const liveExtensionOpenAI =
                (stContext?.extensionSettings?.openai && typeof stContext.extensionSettings.openai === 'object')
                    ? stContext.extensionSettings.openai
                    : {};

            // HUD regeneration must use the current SillyTavern Chat Completions
            // backend, not the legacy /api/chat/completions route captured from an
            // older request. The latter is not the generation endpoint in current ST
            // and can return 403. The captured request is still useful as a source of
            // provider/model/token settings, but its URL is deliberately NOT reused.
            const sourceBody = window.lastTavernRequest?.body;
            const reqBody = sourceBody && typeof sourceBody === 'object' ? sourceBody : {};
            const requestUrl = '/api/backends/chat-completions/generate';
            const requestHeaders =
                (typeof window.getRequestHeaders === 'function' ? window.getRequestHeaders() : null) ||
                { 'Content-Type': 'application/json' };

            // SillyTavern stores provider/model selections in source-specific fields.
            // See the default Chat Completion preset: chat_completion_source plus
            // openai_model / google_model / vertexai_model / custom_model, etc.
            const currentSource = String(
                reqBody.chat_completion_source ||
                liveChatCompletionSettings.chat_completion_source ||
                liveExtensionOpenAI.chat_completion_source ||
                liveOpenAISettings.chat_completion_source ||
                ''
            );
            const currentModel = String(
                reqBody.model ||
                liveChatCompletionSettings.model ||
                liveChatCompletionSettings.openai_model ||
                liveChatCompletionSettings.google_model ||
                liveChatCompletionSettings.vertexai_model ||
                liveChatCompletionSettings.openrouter_model ||
                liveChatCompletionSettings.custom_model ||
                liveExtensionOpenAI.model ||
                liveExtensionOpenAI.openai_model ||
                liveExtensionOpenAI.google_model ||
                liveExtensionOpenAI.vertexai_model ||
                liveExtensionOpenAI.openrouter_model ||
                liveExtensionOpenAI.custom_model ||
                liveOpenAISettings.model ||
                liveOpenAISettings.openai_model ||
                liveOpenAISettings.google_model ||
                liveOpenAISettings.vertexai_model ||
                liveOpenAISettings.openrouter_model ||
                liveOpenAISettings.custom_model ||
                ''
            );
            const currentChatSettings = liveChatCompletionSettings;
            const currentOpenAISettings = liveExtensionOpenAI;
            const globalOpenAISettings = liveOpenAISettings;

            let freshMessages = [];
            // Only real chat-history messages are eligible for HUD summarization.
            // Injected HUD instructions contain a literal [HUD] schema example, which
            // must NEVER be mistaken for an actual historical HUD block.
            const hudSummaryEligibleMessages = new Set();

            const keepN = parseInt(settings.regenContextMessages, 10);
            let startIndex = keepN > 0 ? Math.max(0, mesIdNum - keepN + 1) : 0;

            function getHudConnectionProfile(profileId) {
                try {
                    const cm = stContext?.extensionSettings?.connectionManager;
                    const profiles = Array.isArray(cm?.profiles) ? cm.profiles : [];
                    return profileId ? (profiles.find(p => String(p.id) === String(profileId)) || null) : null;
                } catch (_) { return null; }
            }

            function metadataLooksLikeGemini(value, depth = 0) {
                if (!value || typeof value !== 'object' || depth > 2) return false;
                const keys = ['api_type', 'api-type', 'apiType', 'type', 'source', 'provider', 'api', 'name', 'model'];
                for (const key of keys) {
                    const field = value[key];
                    if (typeof field === 'string') {
                        const lower = field.toLowerCase();
                        if (lower.includes('gemini') || lower.includes('makersuite') || lower.includes('google')) return true;
                    } else if (field && typeof field === 'object' && metadataLooksLikeGemini(field, depth + 1)) {
                        return true;
                    }
                }
                return false;
            }

            const selectedProfile = getHudConnectionProfile(settings.regenProfileId);
            const backendMetadata = [
                selectedProfile,
                reqBody,
                stContext?.chatCompletionSettings,
                stContext?.extensionSettings?.connectionManager,
                stContext?.extensionSettings?.openai,
                stContext?.extensionSettings?.gemini,
                currentChatSettings,
                currentOpenAISettings,
                globalOpenAISettings,
            ];
            const requestModel = String(reqBody?.model || selectedProfile?.model || currentModel || '');
            const modelName = requestModel.toLowerCase();
            const requestUrlLower = String(requestUrl || '').toLowerCase();
            const isGeminiBackend = backendMetadata.some(metadataLooksLikeGemini)
                || modelName.includes('gemini')
                || requestUrlLower.includes('generativelanguage.googleapis.com')
                || requestUrlLower.includes('/gemini');
            const regenRoleForBackend = (role) => {
                if (role === 'system') return isGeminiBackend ? 'user' : 'system';
                if (role === 'assistant') return isGeminiBackend ? 'model' : 'assistant';
                return 'user';
            };
            if (reqBody.messages && reqBody.messages[0] && reqBody.messages[0].role === 'system') {
                freshMessages.push({ ...reqBody.messages[0], role: regenRoleForBackend('system') });
            }
            // IMPORTANT: HUD Regen must receive the FULL HUD contract, not only a short
            // command. The previous version sent only strictBasePrompt, which left the
            // model without the complete schema/field definitions and caused it to return
            // an all-empty HUD. Reuse the exact same dynamic HUD prompt as normal chat
            // generation, then add the Regen-specific instruction.
            const strictBasePrompt = buildDynamicPrompt() + "\n\n<system_note>REGEN OVERRIDE (CRITICAL): Read the recent conversation below and produce a fresh, fully updated [HUD] block for the current state. Recalculate all fields from the available narrative and persistent context. Preserve continuity instead of replacing known facts with empty values. Output ONLY the HUD block and nothing else.</system_note>";

            for (let i = startIndex; i <= mesIdNum; i++) {
            let msg = chatData[i];
            if (!msg) continue;
            let role = regenRoleForBackend(msg.is_user ? 'user' : 'assistant');
            let content = msg.swipes && msg.swipes[msg.swipe_id] !== undefined ? msg.swipes[msg.swipe_id] : msg.mes;
            
            if (i === mesIdNum) {
                // У текущего сообщения вырезаем старый HUD полностью, так как будем генерировать новый
                content = content.replace(extractRegex, '').trim();
                if (content.length > 0) {
                    const message = { role: regenRoleForBackend('assistant'), content: content };
                    freshMessages.push(message);
                    hudSummaryEligibleMessages.add(message);
                }
                // strictPrompt ещё не существует на этой стадии: Lorebook-контекст
                // рассчитывается после сборки истории. Ставим базовый маркер, а ниже
                // он будет заменён на полный strictPrompt + HUD lore context.
                freshMessages.push({ role: regenRoleForBackend('user'), content: strictBasePrompt });
            } else {
                // В старых сообщениях оставляем текст как есть, чтобы скрипт ниже смог найти и сжать HUD
                if (content.trim().length > 0) {
                    const message = { role: role, content: content.trim() };
                    freshMessages.push(message);
                    hudSummaryEligibleMessages.add(message);
                }
            }
        }

        const loreScanText = freshMessages.map(m => typeof m.content === 'string' ? m.content : '').join('\n');
        const hudExternalContext = await buildHudLoreContext(loreScanText);
        const strictPrompt = strictBasePrompt + hudExternalContext;
        let strictPromptMessage = null;
        for (let i = freshMessages.length - 1; i >= 0; i--) {
            const candidate = freshMessages[i];
            if (candidate && candidate.role === regenRoleForBackend('user') && candidate.content === strictBasePrompt) {
                strictPromptMessage = candidate;
                break;
            }
        }
        if (strictPromptMessage) strictPromptMessage.content = strictPrompt;
        else freshMessages.push({ role: regenRoleForBackend('user'), content: strictPrompt });

        // --- ЛОГИКА САММАРИ ДЛЯ РЕГЕНЕРАЦИИ ---
        const buildSummaryTextRegen = (hudText) => {
            let parsedObj = parseHUDComplex(hudText);
            let summaryStr = `[HUD_SUMMARY] `;
            
            if (parsedObj.scene && parsedObj.scene['Время']) summaryStr += `Время: ${parsedObj.scene['Время']}. `;
            if (parsedObj.scene && parsedObj.scene['Погода']) summaryStr += `Погода: ${parsedObj.scene['Погода']}. `;
            
            let cSums = [];
            if (parsedObj.characters) {
                parsedObj.characters.forEach(c => {
                    if (c['Имя']) {
                        let details = [];
                        if (c['Возраст'] && String(c['Возраст']).toLowerCase() !== 'empty' && String(c['Возраст']).toLowerCase() !== 'none') details.push(`Возраст: ${c['Возраст']}`);
                        if (c['Место'] && String(c['Место']).toLowerCase() !== 'empty' && String(c['Место']).toLowerCase() !== 'none') details.push(`Место: ${c['Место']}`);
                        cSums.push(details.length > 0 ? `${c['Имя']} (${details.join(', ')})` : c['Имя']);
                    }
                });
            }
            if (parsedObj.user) {
                let uDetails = [];
                if (parsedObj.user['Возраст'] && String(parsedObj.user['Возраст']).toLowerCase() !== 'empty' && String(parsedObj.user['Возраст']).toLowerCase() !== 'none') uDetails.push(`Возраст: ${parsedObj.user['Возраст']}`);
                if (parsedObj.user['Место'] && String(parsedObj.user['Место']).toLowerCase() !== 'empty' && String(parsedObj.user['Место']).toLowerCase() !== 'none') uDetails.push(`Место: ${parsedObj.user['Место']}`);
                if (uDetails.length > 0) cSums.push(`User (${uDetails.join(', ')})`);
                else if (Object.keys(parsedObj.user).length > 0) cSums.push(`User`);
            }
            if (cSums.length > 0) summaryStr += cSums.join('; ') + ` `;
            
            return summaryStr + `[/HUD_SUMMARY]`;
        };

        let allMatchesRegen = [];
        freshMessages.forEach((msg, mIdx) => {
            // Do not scan injected system/HUD instructions. buildDynamicPrompt()
            // intentionally contains a literal [HUD] schema example. Scanning it here
            // makes the regen code try to parse its own instructions as an old HUD,
            // which can fail BEFORE the API request is even sent.
            if (!hudSummaryEligibleMessages.has(msg)) return;
            if (typeof msg.content === 'string') {
                const regexLocal = /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)([\s\S]*?)(?:(?:\[|&lt;|<|&#91;)\s*(?:\/|&#47;|\\)\s*HUD\s*(?:\]|&gt;|>|&#93;)|$)/ig;
                let match;
                while ((match = regexLocal.exec(msg.content)) !== null) {
                    allMatchesRegen.push({ mIdx, index: match.index, length: match[0].length });
                }
            }
        });

        let hudsToKeep = parseInt(settings.hudsToKeep, 10);
        if (isNaN(hudsToKeep) || hudsToKeep < 0) hudsToKeep = 2;
        
        if (allMatchesRegen.length > hudsToKeep) {
            let toSummarize = allMatchesRegen.slice(0, allMatchesRegen.length - hudsToKeep);
            // Сортируем с конца в начало, чтобы не сбить индексы при замене текста
            toSummarize.sort((a, b) => (a.mIdx !== b.mIdx ? b.mIdx - a.mIdx : b.index - a.index));
            
            toSummarize.forEach(rm => {
                let content = freshMessages[rm.mIdx].content;
                let hudBlockText = content.substring(rm.index, rm.index + rm.length);
                
                freshMessages[rm.mIdx].content = content.slice(0, rm.index) + '\n' + buildSummaryTextRegen(hudBlockText) + '\n' + content.slice(rm.index + rm.length);
            });
        }

        let aiText = '';
        const hudMaxTokens = Math.max(256, Math.min(32768, parseInt(settings.hudMaxTokens, 10) || 8192));

        // Reuse the last working SillyTavern payload. Provider-specific fields are
        // required by some backends, so a handcrafted minimal body can be rejected
        // even though normal generation works.
        const capturedBody = (window.lastTavernRequest?.body && typeof window.lastTavernRequest.body === 'object')
            ? window.lastTavernRequest.body : null;
        const hudRequestBody = capturedBody ? JSON.parse(JSON.stringify(capturedBody)) : {};
        hudRequestBody.messages = freshMessages;
        hudRequestBody.stream = false;
        if (requestModel) hudRequestBody.model = requestModel;
        const hudSource = String(reqBody?.chat_completion_source || currentSource || '');
        if (hudSource) hudRequestBody.chat_completion_source = hudSource;
        if (Object.prototype.hasOwnProperty.call(hudRequestBody, 'max_new_tokens')) hudRequestBody.max_new_tokens = hudMaxTokens;
        else hudRequestBody.max_tokens = hudMaxTokens;

        if (settings.regenProfileId && stContext && stContext.ConnectionManagerRequestService && typeof stContext.ConnectionManagerRequestService.sendRequest === 'function') {
            // ConnectionManagerRequestService accepts a ChatMessage[] as its prompt.
            // Disable preset/instruct injection so the selected profile supplies only
            // the connection details; our HUD messages remain the actual prompt.
            const profileResult = await stContext.ConnectionManagerRequestService.sendRequest(
                settings.regenProfileId,
                freshMessages,
                hudMaxTokens,
                { stream: false, includePreset: false, includeInstruct: false }
            );
            if (typeof profileResult === 'string') aiText = profileResult;
            else if (profileResult && profileResult.choices && profileResult.choices[0]) aiText = profileResult.choices[0].message ? profileResult.choices[0].message.content : profileResult.choices[0].text;
            else if (profileResult && Array.isArray(profileResult.content)) aiText = profileResult.content.map(c => c.text).join('');
            else if (profileResult && typeof profileResult.content === 'string') aiText = profileResult.content;
            else if (profileResult && profileResult.text) aiText = profileResult.text;
            else aiText = JSON.stringify(profileResult);
        } else {
            let res;
            window.__tavernOSHudRegenRequest = true;
            try {
                res = await fetch(requestUrl, { method: 'POST', headers: requestHeaders, cache: 'no-cache', body: JSON.stringify(hudRequestBody) });
            } finally {
                window.__tavernOSHudRegenRequest = false;
            }
            if (!res.ok) {
                const apiError = await readHudApiError(res);
                throw new Error(`API Error ${apiError.status}: ${apiError.message}`);
            }
            const data = await res.json();
            if (data.choices && data.choices[0]) aiText = data.choices[0].message ? data.choices[0].message.content : data.choices[0].text;
            else if (data.content && Array.isArray(data.content)) aiText = data.content.map(c => c.text).join('');
            else if (data.text) aiText = data.text;
            else if (data.candidates && data.candidates[0] && data.candidates[0].content) aiText = data.candidates[0].content.parts.map(p => p.text).join('');
            else aiText = JSON.stringify(data);
        }

            let newHudText = repairGeneratedHudBlock(aiText);

            let updatedFullText = replaceHudBlockInText(oldText, newHudText);

            updateMessageDataForCurrentSwipe(targetMessage, updatedFullText);

            const saveFn =
                (stContext && typeof stContext.saveChatConditional === 'function') ? stContext.saveChatConditional.bind(stContext) :
                (stContext && typeof stContext.saveChat === 'function') ? stContext.saveChat.bind(stContext) :
                (typeof saveChatConditional === 'function') ? saveChatConditional :
                (typeof window.saveChatConditional === 'function') ? window.saveChatConditional :
                (typeof window.saveChat === 'function') ? window.saveChat : null;

            const updateFn = getMessageUpdateFunction(stContext);

            if (updateFn) {
                await Promise.resolve(updateFn(mesIdNum, targetMessage, { rerenderMessage: true }));
            } else {
                textElement.innerHTML = updatedFullText;
            }

            // После штатного обновления ST повторно обрабатываем только HUD.
            // Сам message DOM SillyTavern не пересоздаём.
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const freshMesEl = document.querySelector(`.mes[mesid="${mesId}"]`) || mesEl;
                    if (freshMesEl && freshMesEl.isConnected) {
                        freshMesEl.removeAttribute('data-hud-processed');
                        safeProcessMessage(freshMesEl);
                    }
                });
            });

            if (loadingToast) {
                loadingToast.classList.add('hide');
                setTimeout(() => loadingToast.remove(), 400);
            }

            showHudToast('success', 'Успех', 'HUD сгенерирован и вшит в сообщение!');

            if (saveFn) {
                saveFn().catch(saveErr => showHudToast('error', 'Не сохранено', 'HUD показан, но не записан: ' + saveErr.message));
            } else {
                showHudToast('error', 'Не сохранено', 'Функция сохранения чата не найдена.');
            }

        } catch (err) {
            if (loadingToast) {
                loadingToast.classList.add('hide');
                setTimeout(() => loadingToast.remove(), 400);
            }
            showHudToast('error', 'Ошибка', 'Не удалось обновить HUD: ' + err.message);
        } finally {
            if (regenBtn.isConnected) {
                regenBtn.innerHTML = originalBtnContent;
                regenBtn.classList.remove('hud-spinning');
            } else {
                const strandedBtn = mesEl && mesEl.querySelector('.hud-regen-btn.hud-spinning');
                if (strandedBtn) strandedBtn.classList.remove('hud-spinning');
            }
        }
        return;
  }

  function bindHudRegenButton(regenBtn) {
    if (!regenBtn || regenBtn.dataset.hudClickBound === 'true') return;
    regenBtn.dataset.hudClickBound = 'true';

    const invoke = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      void handleHudRegenButton(regenBtn);
    };

    // Direct listener remains useful when ST does not intercept the event.
    regenBtn.addEventListener('click', invoke, true);
    regenBtn.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      invoke(e);
    }, true);
  }

  function initGlobalEvents() {
    if (window.hudEventsInitialized) return;
    window.hudEventsInitialized = true;

    document.body.addEventListener('change', function(e) {
      const toggle = e.target.closest('.hud-toggle-input');
      if (!toggle) return;
      const card = toggle.closest('.hud-os-card');
      if (!card) return;
      if (toggle.checked) card.dataset.userExpanded = 'true';
      else delete card.dataset.userExpanded;
    });

    document.addEventListener('click', async function(e) {
      // === НАЖАТИЕ НА КНОПКУ ПАПКИ ===
      const uploadBtn = e.target.closest('.hud-bg-upload-btn');
      if (uploadBtn) {
        e.preventDefault();
        e.stopPropagation();
        const fileInput = uploadBtn.nextElementSibling;
        if (fileInput && fileInput.classList.contains('hud-bg-upload-file')) {
            // Привязываем загрузку
            fileInput.onchange = (ev) => {
                const file = ev.target.files[0];
                if (!file) return;
                if (file.size > 3 * 1024 * 1024) {
                    showHudToast('error', 'Слишком большой файл', 'Выберите картинку до 3 МБ.');
                    return;
                }
                const reader = new FileReader();
                reader.onload = (readEv) => {
                    settings.bgImage = readEv.target.result;
                    saveSettings();
                    applyThemeColors();
                    // Красиво пишем во всех карточках, что файл локальный
                    document.querySelectorAll('.hud-theme-text-input[data-key="bgImage"]').forEach(inp => inp.value = '(Локальный файл)');
                    showHudToast('success', 'Фон загружен', 'Картинка успешно установлена!');
                };
                reader.readAsDataURL(file);
            };
            fileInput.click(); // Имитируем клик по скрытому инпуту
        }
        return;
      }

      const loreTip = e.target.closest('.hud-lore-tooltip');
      if (loreTip) {
        e.preventDefault();
        e.stopPropagation();
        const wasOpen = loreTip.classList.contains('tooltip-open');
        document.querySelectorAll('.hud-lore-tooltip.tooltip-open').forEach(el => { if (el !== loreTip) el.classList.remove('tooltip-open'); });
        loreTip.classList.toggle('tooltip-open', !wasOpen);
        return;
      }
      document.querySelectorAll('.hud-lore-tooltip.tooltip-open').forEach(el => el.classList.remove('tooltip-open'));

      const themeBtn = e.target.closest('.hud-theme-btn');
      if (themeBtn) {
        e.preventDefault();
        e.stopPropagation();
        const card = themeBtn.closest('.hud-os-card');
        const panel = card.querySelector('.hud-theme-panel');
        if (panel) panel.classList.toggle('active');
        return;
      }

      const hudActionBtn = e.target.closest && e.target.closest('.hud-regen-btn');
      if (hudActionBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        void handleHudRegenButton(hudActionBtn);
        return;
      }

      const tab = e.target.closest('.hud-tab');
      if (tab) {
        e.preventDefault();
        const parent = tab.closest('.hud-os-wrapper');
        parent.querySelectorAll('.hud-tab').forEach(t => t.classList.remove('active'));
        parent.querySelectorAll('.hud-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        parent.querySelector(`#${tab.dataset.target}`).classList.add('active');
        return;
      }

      const secretToggle = e.target.closest('[data-secret-toggle]');
      if (secretToggle) {
        const id = secretToggle.getAttribute('data-secret-toggle');
        const body = document.getElementById(id);
        if (body) {
          const open = !body.hidden;
          body.hidden = open;
          secretToggle.setAttribute('aria-expanded', String(!open));
          secretToggle.closest('.hud-memory-secret')?.classList.toggle('is-open', !open);
        }
        return;
      }

      const participantsToggle = e.target.closest('.hud-phone-title-group');
      if (participantsToggle && participantsToggle.querySelector('.hud-phone-participants-list')) {
        e.preventDefault();
        const list = participantsToggle.querySelector('.hud-phone-participants-list');
        const mockup = participantsToggle.closest('.hud-phone-mockup');
        if (mockup) {
          mockup.querySelectorAll('.hud-phone-participants-list.active').forEach(el => {
            if (el !== list) el.classList.remove('active');
          });
        }
        list.classList.toggle('active');
        return;
      }

      const subtab = e.target.closest('.hud-phone-subtab');
      if (subtab) {
        e.preventDefault();
        const mockup = subtab.closest('.hud-phone-mockup');
        mockup.querySelectorAll('.hud-phone-subtab').forEach(t => t.classList.remove('active'));
        mockup.querySelectorAll('.hud-phone-subbody').forEach(b => b.classList.remove('active'));
        subtab.classList.add('active');
        mockup.querySelector(`#${subtab.dataset.subtarget}`).classList.add('active');
        return;
      }

      const widget = e.target.closest('.hud-scene-widget');
      if (widget) {
        widget.classList.toggle('fx-active');
      }

    }, true); 

    // ОБРАБОТЧИК ПОЛЗУНКОВ ЦВЕТА И ТЕМЫ
    document.body.addEventListener('input', function(e) {
      const themeInput = e.target.closest('.hud-theme-color-input, .hud-theme-range-input, .hud-theme-select-input, .hud-theme-text-input');
      if (themeInput) {
          const varKey = themeInput.dataset.key;
          
          if (varKey === 'bgImage') return; 
          
          settings[varKey] = themeInput.value;
          
          applyThemeColors(); 
          saveSettings();     
          
          let displayVal = themeInput.nextElementSibling;
          if (displayVal && displayVal.tagName === 'SPAN') {
              displayVal.textContent = themeInput.value + 'px';
          }
          
          document.querySelectorAll(`[data-key="${varKey}"]`).forEach(inp => {
              if (inp !== themeInput) inp.value = themeInput.value;
          });
      }
    });

  }

  let observer = null;

  function initObserver(chatContainer) {
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver((mutations) => {
      const touchedMessages = new Set();
      let avatarChanged = false;

      for (const mutation of mutations) {
        // Изменился текст внутри сообщения.
        if (mutation.type === 'characterData') {
          const mes = mutation.target.parentElement?.closest?.('.mes');
          if (mes) { touchedMessages.add(mes); }
        }

        // Добавились новые DOM-ноды.
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          if (node.matches?.('.mes')) {
            touchedMessages.add(node);
            avatarChanged = true;
            if (performanceIntersectionObserver) performanceIntersectionObserver.observe(node);
          }
          node.querySelectorAll?.('.mes').forEach(mes => {
            touchedMessages.add(mes);
            avatarChanged = true;
            if (performanceIntersectionObserver) performanceIntersectionObserver.observe(mes);
          });
          if (node.matches?.('.avatar img, .avatar_img') || node.querySelector?.('.avatar img, .avatar_img')) avatarChanged = true;
          const parentMes = node.closest?.('.mes');
          if (parentMes) touchedMessages.add(parentMes);
        });

        // Изменение childList внутри существующего сообщения.
        if (mutation.type === 'childList') {
          const targetMes = mutation.target.closest?.('.mes');
          if (targetMes) touchedMessages.add(targetMes);
          if (mutation.target.closest?.('.avatar, .avatar img') || mutation.target.matches?.('.avatar, .avatar img')) avatarChanged = true;
        }
      }

      if (!touchedMessages.size) return;
      if (avatarChanged) invalidateAvatarCache();

      // Не запускаем processMessage десятки раз подряд
      // на одной пачке DOM-изменений.
      requestAnimationFrame(() => {
        const performanceActive = isPerformanceModeActive(chatContainer);
        touchedMessages.forEach(mes => {
          if (!mes.isConnected) return;
          // В Performance Mode старые сообщения не гоняем через полный процессор на каждую
          // внутреннюю мутацию. IntersectionObserver обработает их, когда они приблизятся к экрану.
          if (performanceActive && mes.classList.contains('hud-perf-older') && !mes.classList.contains('hud-perf-visible')) return;
          safeProcessMessage(mes);
        });
        if (performanceActive) refreshPerformanceMessageClasses();
        schedulePerformanceRefresh();
      });
    });

    observer.observe(chatContainer, {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: false
    });
  }


  function addSettingsUI() {
    if (document.getElementById('hud-settings-wrapper')) return;
    const container = document.getElementById('extensions_settings') || document.getElementById('rm_extensions_block') || document.body;
    if (!container) return;
    const wrapper = document.createElement('details');
    wrapper.id = 'hud-settings-wrapper';
    wrapper.className = 'hud-settings-block';
    wrapper.innerHTML = `
      <summary style="font-weight:bold; cursor:pointer; color:var(--hud-accent); outline: none;">📊 TavernOS v21.5.4</summary>
      <div style="padding-top: 12px; display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;"><input type="checkbox" id="hud-auto-inject" ${settings.autoInject ? 'checked' : ''}> Сетевой перехват (Инжект промпта)</label>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;"><input type="checkbox" id="hud-enable-phone" ${settings.enablePhone ? 'checked' : ''}> 📱 Личный телефон</label>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;"><input type="checkbox" id="hud-enable-intercepts" ${settings.enableIntercepts ? 'checked' : ''}> 📡 Перехваты (Чужие телефоны)</label>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;"><input type="checkbox" id="hud-enable-diary" ${settings.enableDiary ? 'checked' : ''}> 📖 Дневник</label>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;"><input type="checkbox" id="hud-enable-dreams" ${settings.enableDreams ? 'checked' : ''}> 🌙 Сновидения</label>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;"><input type="checkbox" id="hud-enable-world" ${settings.enableWorld ? 'checked' : ''}> 🌍 Мир (Новости, слухи)</label>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;" title="Отдельный блок {{user}}: одежда, внешность, здоровье, отношения, локация."><input type="checkbox" id="hud-enable-user" ${settings.enableUserBlock ? 'checked' : ''}> {{user}} — блок игрока</label>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;" title="Таймлайн, настроение двух главных персонажей, маршруты и секреты"><input type="checkbox" id="hud-enable-memory" ${settings.enableMemory ? 'checked' : ''}> 🧠 Память (события, настроение, маршрут, секреты)</label>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;" title="При 200+ сообщениях отключает тяжёлую повторную обработку старых сообщений, замораживает их анимации/эффекты и обрабатывает HUD по мере прокрутки."><input type="checkbox" id="hud-performance-mode" ${settings.performanceMode ? 'checked' : ''}> ⚡ Performance Mode (200+ сообщений)</label>
        <div style="font-size:11px;opacity:.68;">Автоматически включается только в чатах от 200 сообщений. Старые блоки остаются функциональными и догружаются при прокрутке.</div>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">📏 Максимальная высота Памяти: <input type="number" id="hud-memory-max-height" min="200" max="600" value="${settings.memoryMaxHeight}" style="width:70px; background:rgba(0,0,0,.3); border:1px solid var(--hud-border); color:#fff; padding:2px 4px; border-radius:4px;"> px</label>
        <div style="border-top:1px solid var(--hud-border); margin:6px 0;"></div>

        <div style="font-weight:700; color:var(--hud-accent);">📚 Лорбуки для ➕ / 🔄 HUD</div>
        <div style="font-size:12px; opacity:.78;">Выбери один или несколько. Их записи + описание карточки чара + Persona добавляются только в отдельный запрос создания/регенерации HUD. Обычный HUD-инжект не меняется.</div>
        <select id="hud-lorebooks" multiple size="6" style="width:100%; min-height:110px; background:rgba(0,0,0,.3); border:1px solid var(--hud-border); color:#fff; padding:4px; border-radius:5px;"></select>
        <div style="display:flex; gap:8px; align-items:center;">
          <button type="button" id="hud-lorebooks-refresh" style="cursor:pointer;">🔄 Обновить список</button>
          <button type="button" id="hud-lorebooks-clear" style="cursor:pointer;">Очистить выбор</button>
          <span id="hud-lorebooks-status" style="font-size:11px; opacity:.75;"></span>
        </div>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;" title="Отдельный лимит токенов только для запроса создания/регенерации HUD.">
          🧠 Лимит токенов HUD: <input type="number" id="hud-max-tokens" min="256" max="32768" value="${settings.hudMaxTokens}" style="width:70px; background:rgba(0,0,0,.3); border:1px solid var(--hud-border); color:#fff; padding:2px 4px; border-radius:4px;">
        </label>
        <div style="border-top: 1px solid var(--hud-border); margin: 6px 0;"></div>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;" title="Оставляет сводку [HUD_SUMMARY] вместо старых блоков. Если ставишь 2 — то 2 последних будут полными HUD, а все что старше превратятся в сводку памяти. 0 = даже самый свежий HUD будет сжат в сводку (модель не увидит полный JSON последнего состояния — не рекомендуется).">
          💾 Сколько развернутых HUD оставлять: <input type="number" id="hud-keep-count" min="0" max="10" value="${settings.hudsToKeep}" style="width: 40px; background: rgba(0,0,0,0.3); border: 1px solid var(--hud-border); color: #fff; padding: 2px 4px; border-radius: 4px;">
        </label>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;" title="Сколько последних сообщений отправлять модели при нажатии на 🔄 (регенерация HUD). 0 = отправлять всю историю чата до этого сообщения.">
          ⚡ При регене HUD слать последние <input type="number" id="hud-regen-context" min="0" max="50" value="${settings.regenContextMessages}" style="width: 40px; background: rgba(0,0,0,0.3); border: 1px solid var(--hud-border); color: #fff; padding: 2px 4px; border-radius: 4px;"> сообщ.
        </label>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;" title="Позволяет перегенерировать HUD (🔄) через ДРУГОЙ сохранённый профиль подключения">
          🧠 Профиль для регена HUD:
          <select id="hud-regen-profile" style="flex:1; background: rgba(0,0,0,0.3); border: 1px solid var(--hud-border); color: #fff; padding: 2px 4px; border-radius: 4px;">
            <option value="">Основной (текущий активный)</option>
          </select>
          <span id="hud-regen-profile-refresh" title="Обновить список профилей" style="cursor:pointer;">🔄</span>
        </label>
      </div>`;
    container.appendChild(wrapper);

    const bgUrlInput = document.getElementById('hud-bg-url-input');
    const bgUploadBtn = document.getElementById('hud-bg-upload-btn');
    const bgUploadFile = document.getElementById('hud-bg-upload-file');
	

    if (bgUrlInput && bgUploadBtn && bgUploadFile) {
        // 1. Загрузка через URL
        bgUrlInput.addEventListener('change', (e) => {
            const url = e.target.value.trim();
            if (!url) {
                settings.bgImage = ''; saveSettings(); applyThemeColors(); return;
            }
            showHudToast('loading', 'Проверка...', 'Пытаемся загрузить картинку...');
            const img = new Image();
            img.onload = () => {
                settings.bgImage = url; saveSettings(); applyThemeColors();
                showHudToast('success', 'Фон загружен', 'Картинка по ссылке успешно установлена.');
            };
            img.onerror = () => {
                showHudToast('error', 'Ошибка ссылки', 'Не удалось загрузить! Сайт заблокировал доступ (CORS) или ссылка битая.');
                e.target.value = settings.bgImage; // Откатываем текст обратно
            };
            img.src = url;
        });

        // 2. Загрузка из локальной галереи
        bgUploadBtn.addEventListener('click', () => bgUploadFile.click());
        bgUploadFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Защита от переполнения памяти браузера (~3 МБ)
            if (file.size > 3 * 1024 * 1024) {
                showHudToast('error', 'Слишком большой файл', 'Выберите картинку до 3 МБ, иначе настройки сломаются.');
                return;
            }

            const reader = new FileReader();
            reader.onload = (ev) => {
                const base64 = ev.target.result;
                settings.bgImage = base64;
                bgUrlInput.value = '(Локальный файл)';
                saveSettings();
                applyThemeColors();
                showHudToast('success', 'Фон загружен', 'Ваша картинка успешно установлена.');
            };
            reader.readAsDataURL(file);
        });
    }
    // === КОНЕЦ ЛОГИКИ ФОНА ===

    document.getElementById('hud-auto-inject').addEventListener('change', (e) => { settings.autoInject = e.target.checked; saveSettings(); });
    document.getElementById('hud-enable-phone').addEventListener('change', (e) => { settings.enablePhone = e.target.checked; saveSettings(); });
    document.getElementById('hud-enable-intercepts').addEventListener('change', (e) => { settings.enableIntercepts = e.target.checked; saveSettings(); });
    document.getElementById('hud-enable-diary').addEventListener('change', (e) => { settings.enableDiary = e.target.checked; saveSettings(); });
    document.getElementById('hud-enable-dreams').addEventListener('change', (e) => { settings.enableDreams = e.target.checked; saveSettings(); });
    document.getElementById('hud-enable-world').addEventListener('change', (e) => { settings.enableWorld = e.target.checked; saveSettings(); });
    document.getElementById('hud-enable-user').addEventListener('change', (e) => { settings.enableUserBlock = e.target.checked; saveSettings(); });
    
    // === ВОТ СЮДА ВСТАВЛЯЕМ НАШУ НОВУЮ ГАЛОЧКУ ===
    document.getElementById('hud-enable-memory').addEventListener('change', (e) => { settings.enableMemory = e.target.checked; saveSettings(); });
    document.getElementById('hud-performance-mode').addEventListener('change', (e) => {
      settings.performanceMode = e.target.checked;
      saveSettings();
      updatePerformanceMode();
      setupPerformanceObserver();
      processAllMessages();
    });
    document.getElementById('hud-memory-max-height').addEventListener('change', (e) => { let v=parseInt(e.target.value,10); if(isNaN(v)) v=300; v=Math.max(200,Math.min(600,v)); settings.memoryMaxHeight=v; e.target.value=v; saveSettings(); applyThemeColors(); });
    

    populateHudLorebookSelect();
    document.getElementById('hud-lorebooks-refresh').addEventListener('click', populateHudLorebookSelect);
    document.getElementById('hud-lorebooks-clear').addEventListener('click', () => {
      const select = document.getElementById('hud-lorebooks');
      if (select) Array.from(select.options).forEach(o => { o.selected = false; });
      settings.hudLorebooks = []; saveSettings(); updateHudLorebookStatus();
    });
    document.getElementById('hud-lorebooks').addEventListener('change', (e) => {
      settings.hudLorebooks = Array.from(e.target.selectedOptions).map(o => o.value);
      saveSettings(); updateHudLorebookStatus();
    });
    document.getElementById('hud-max-tokens').addEventListener('change', (e) => {
      let val = parseInt(e.target.value, 10);
      if (isNaN(val) || val < 256) val = 256; if (val > 32768) val = 32768;
      settings.hudMaxTokens = val; e.target.value = val; saveSettings();
    });

    document.getElementById('hud-keep-count').addEventListener('change', (e) => { 
      let val = parseInt(e.target.value);
      if (isNaN(val) || val < 0) val = 0; if (val > 10) val = 10;
      settings.hudsToKeep = val; e.target.value = val; saveSettings(); 
    });
    document.getElementById('hud-regen-context').addEventListener('change', (e) => {
      let val = parseInt(e.target.value);
      if (isNaN(val) || val < 0) val = 0; if (val > 50) val = 50;
      settings.regenContextMessages = val; e.target.value = val; saveSettings();
    });

    populateRegenProfileSelect();
    document.getElementById('hud-regen-profile-refresh').addEventListener('click', populateRegenProfileSelect);
    document.getElementById('hud-regen-profile').addEventListener('change', (e) => {
      settings.regenProfileId = e.target.value || '';
      saveSettings();
    });
  }


  async function populateHudLorebookSelect() {
    const select = document.getElementById('hud-lorebooks');
    const status = document.getElementById('hud-lorebooks-status');
    if (!select) return;
    const previous = new Set(Array.isArray(settings.hudLorebooks) ? settings.hudLorebooks : []);
    if (status) status.textContent = 'Загрузка...';
    const names = await getAvailableHudLorebooks();
    select.innerHTML = '';
    names.forEach(name => {
      const option = document.createElement('option');
      option.value = name; option.textContent = name; option.selected = previous.has(name);
      select.appendChild(option);
    });
    settings.hudLorebooks = names.filter(name => previous.has(name));
    saveSettings(); updateHudLorebookStatus();
  }

  function updateHudLorebookStatus() {
    const status = document.getElementById('hud-lorebooks-status');
    if (!status) return;
    const count = Array.isArray(settings.hudLorebooks) ? settings.hudLorebooks.length : 0;
    status.textContent = count ? `Выбрано: ${count}` : 'Ничего не выбрано';
  }

  function populateRegenProfileSelect() {
    const select = document.getElementById('hud-regen-profile');
    if (!select) return;
    let stContext = null;
    if (typeof window.SillyTavern !== 'undefined' && typeof window.SillyTavern.getContext === 'function') {
      stContext = window.SillyTavern.getContext();
    } else if (typeof getContext === 'function') {
      stContext = getContext();
    } else if (typeof window.getContext === 'function') {
      stContext = window.getContext();
    }
    const profiles = stContext && stContext.extensionSettings && stContext.extensionSettings.connectionManager
      ? (stContext.extensionSettings.connectionManager.profiles || [])
      : [];

    const prevValue = settings.regenProfileId || '';
    select.innerHTML = `<option value="">Основной (текущий активный)</option>`;
    profiles.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name || p.id;
      select.appendChild(opt);
    });
    select.value = profiles.some(p => p.id === prevValue) ? prevValue : '';
    if (select.value !== prevValue) { settings.regenProfileId = select.value; saveSettings(); }

    if (!profiles.length) {
      const opt = document.createElement('option');
      opt.value = ''; opt.disabled = true;
      opt.textContent = '(Connection Manager не найден или профилей нет)';
      select.appendChild(opt); // раньше опция создавалась, но не добавлялась в select — была мёртвым кодом
    }
  }
  
    function initWandButton() {
    function attachWandButton() {
        const wandMenu = document.getElementById('extensionsMenu');
        if (!wandMenu) return false;
        
        if (document.getElementById('hud-fix-wand-btn')) return true;

        const btn = document.createElement('div');
        btn.id = 'hud-fix-wand-btn';
        btn.className = 'list-group-item flex-container flexGapSm justifyCenter interactable';
        btn.innerHTML = `<span style="font-size:1.1em; opacity:0.8;">✂️</span><span>Fix HUD (Cut & Regen)</span>`;
        btn.style.cursor = 'pointer';

        btn.addEventListener('click', async () => {
            // Кнопка находится внутри уже открытого extensionsMenu.
            // Не переключаем extensions_button здесь: это могло закрыть меню
            // прямо в момент запуска операции.
            let stContext = typeof SillyTavern !== 'undefined' && SillyTavern.getContext ? SillyTavern.getContext() : (typeof window.getContext === 'function' ? window.getContext() : null);
            let chatData = stContext && stContext.chat ? stContext.chat : window.chat;
            if (!chatData || chatData.length === 0) return;
            
            let lastMesIndex = chatData.length - 1;
            let targetMessage = chatData[lastMesIndex];
            if (targetMessage.is_user || targetMessage.is_system) {
                 showHudToast('error', 'Ошибка', 'Последнее сообщение не от персонажа.');
                 return;
            }

            let oldText = targetMessage.swipes && targetMessage.swipe_id !== undefined ? targetMessage.swipes[targetMessage.swipe_id] : targetMessage.mes;
            
            const brokenHudRegex = /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)[\s\S]*$/i;
            
            if (!brokenHudRegex.test(oldText)) {
                 showHudToast('error', 'Ошибка', 'Тег [HUD] не найден в последнем сообщении.');
                 return;
            }

            let newText = oldText.replace(brokenHudRegex, '').trim();
            updateMessageDataForCurrentSwipe(targetMessage, newText);
                try {
                    const postUpdateHud = extractHudBlock(newText);
                    console.info('[TavernOS HUD] HUD update:', {
                        generated: true,
                        wrapped: /^\[HUD\]\s*```json/i.test(newText),
                        parse: !!postUpdateHud,
                        repaired: false,
                    });
                } catch (diagError) {
                    console.debug('[TavernOS HUD] HUD post-update diagnostic failed:', diagError);
                }

            const updateFn = getMessageUpdateFunction(stContext);
            if (updateFn) {
                await Promise.resolve(updateFn(lastMesIndex, targetMessage, { rerenderMessage: true }));
            }

            const saveFn = (stContext && typeof stContext.saveChatConditional === 'function') ? stContext.saveChatConditional.bind(stContext) : window.saveChatConditional;
            if (saveFn) await saveFn();

            showHudToast('success', 'Обрезано', 'Сломанный код удален. Запускаем регенерацию...');

            // HUD только что удалён, поэтому кнопки 🔄 Regen больше нет.
            // После штатного updateMessageBlock() заново обрабатываем сообщение
            // и запускаем именно ➕ Создать HUD.
            const startCreate = () => {
                try {
                    const freshMesEl =
                        document.querySelector(`.mes[mesid="${lastMesIndex}"]`) ||
                        document.querySelector('.mes:last-child');

                    if (!freshMesEl) {
                        showHudToast('error', 'Ошибка', 'Сообщение не найдено после очистки HUD.');
                        return;
                    }

                    freshMesEl.removeAttribute('data-hud-processed');
                    safeProcessMessage(freshMesEl);

                    const createBtn = freshMesEl.querySelector('.hud-create-btn');
                    if (createBtn) createBtn.click();
                    else showHudToast('error', 'Ошибка', 'Кнопка «Создать HUD» не найдена.');
                } catch (createErr) {
                    showHudToast('error', 'Ошибка', 'Не удалось запустить создание HUD: ' + createErr.message);
                }
            };

            requestAnimationFrame(() => requestAnimationFrame(startCreate));
        });

        // ВАЖНО: кнопку нужно добавить в меню сразу после создания.
        // Ранее appendChild оказался внутри click-handler, поэтому кнопка
        // физически никогда не появлялась в меню.
        wandMenu.appendChild(btn);
        return true;
    }

    if (!attachWandButton()) {
        let tries = 0;
        const iv = setInterval(() => { 
            if (attachWandButton() || ++tries > 40) clearInterval(iv); 
        }, 250);
    }
  }
  
  function initTavernOSEvents() {
  if (window.hudTavernEventsInitialized) return;
  window.hudTavernEventsInitialized = true;

  try {
    const stContext =
      window.SillyTavern?.getContext?.() ||
      window.getContext?.();

    const eventSource = stContext?.eventSource;
    const eventTypes = stContext?.event_types;

    if (!eventSource || !eventTypes) return;

    const rerenderMessage = (messageId, delay = 50) => {
      const id = String(messageId);
      setTimeout(() => {
        let mes = null;
        const safeId = (window.CSS && typeof window.CSS.escape === 'function') ? window.CSS.escape(id) : id.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
        try {
          mes = cachedChatContainer?.querySelector?.(`.mes[mesid=\"${safeId}\"]`) || null;
        } catch (_) {}
        if (!mes) {
          mes = Array.from(cachedChatContainer?.querySelectorAll?.('.mes') || []).find(el => String(el.getAttribute('mesid')) === id);
        }

        if (!mes) return;

        mes.removeAttribute('data-hud-processed');
        requestAnimationFrame(() => {
          if (mes.isConnected) safeProcessMessage(mes);
        });
      }, delay);
    };

    if (eventTypes.MESSAGE_UPDATED) {
      eventSource.on(eventTypes.MESSAGE_UPDATED, (messageId) => rerenderMessage(messageId, 50));
    }

    if (eventTypes.MESSAGE_SWIPED) {
      eventSource.on(eventTypes.MESSAGE_SWIPED, (messageId) => rerenderMessage(messageId, 50));
    }

    if (eventTypes.CHARACTER_MESSAGE_RENDERED) {
      eventSource.on(eventTypes.CHARACTER_MESSAGE_RENDERED, (messageId) => rerenderMessage(messageId, 30));
    }
  } catch (_) {
    // Lifecycle events are optional; the normal message processing still works without them.
  }
}

  let initRetries = 0;
  function initApp() {
    const chatContainer = document.querySelector('#chat') || document.querySelector('#chat-container');
    if (!chatContainer) {
      if (initRetries < 40) { initRetries++; setTimeout(initApp, 500); }
      return;
    }
    cachedChatContainer = chatContainer;
    loadSettings(); 
    restoreLastTavernRequest();
    initGlobalEvents();
    initTavernOSEvents();	
    initWandButton(); // Наша новая кнопка!
    updatePerformanceMode();
    processAllMessages(); 
    initObserver(chatContainer);
    if (isPerformanceModeActive(chatContainer)) setupPerformanceObserver();
    chatContainer.addEventListener('scroll', schedulePerformanceRefresh, { passive: true });
    addSettingsUI();
  }
  setTimeout(initApp, 500);
})();
