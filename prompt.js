// hud-manager/prompt.js
//
// Инструкция HUD для модели: задача, общие правила, схема полей. Вынесена из
// index.js — это самый большой его кусок, а нужна она только при генерации.
// index.js грузит модуль через import() (загрузитьПромпт) заранее, когда
// страница затихнет, и в любом случае ждёт его перед отправкой запроса.

import { settings } from './settings.js?v=23.48.3';
import { роды, естьЗачатия, деньРодов, малышиБезРодов, скрытыеФактыЗачатия } from './render/conception.js?v=23.48.3';
import { parseSceneDate } from './history-analyzer.js?v=23.48.3';
import { возрастТочно } from './render/babies.js?v=23.48.3';

// Всё нужное из index.js приходит в «основа» (геттеры — значения живые):
// последнийСнимокОбъект, сверитьРоды.
let основа = null;
export function подключить(связь) { основа = связь; }

/* Инструкция HUD. Отдельное сообщение в конце запроса — после всего, что
   собрал SillyTavern (пресет, карточка, лорбуки, история): задача, общие
   правила, схема и в самом конце снимок последнего HUD через макрос
   {{hudLast}}.
   Правило, которое касается одного поля, живёт в описании этого поля, а не
   в общем списке. Поэтому часть про близость целиком сидит в своих полях и
   вне сцены уходит из промта без следа: в общих правилах нет ни слова о ней,
   и модели не из чего решить, что писать её нужно всегда.
   nsfw  — нужна ли часть про близость (решает hud-snapshot.js);
   режим — 'reply': обычный ответ с HUD в конце; 'regen': только HUD. */
export function buildDynamicPrompt({ nsfw = true, режим = 'reply', бой = false } = {}) {
  // Что включено. Правила и поля собираются только из включённых разделов:
  // модель не должна читать про телефон, которого у неё не просят.
  const болезни = settings.enableIllness !== false;
  const беременность = settings.enablePregnancy !== false;
  // После родов промт беременности уступает место послеродовому периоду и
  // трекеру малышей — замена, а не прибавка. Беременность остаётся, пока
  // кто-то ещё беременен: HUD знает о зачатии или Prg есть в прошлом HUD.
  if (беременность) основа.сверитьРоды();
  const родыБыли = беременность && роды().length > 0;
  // Снимок нужен и без родов: по его дате HUD считает срок беременности.
  const снимокТекст = беременность ? JSON.stringify(основа.последнийСнимокОбъект() || {}) : '';
  const prgВСнимке = /"Prg"\s*:\s*"(?!(?:empty|none)")(?![^"]*brn\s*:)/i.test(снимокТекст);
  const беременностьВПромпт = беременность && (!родыБыли || естьЗачатия() || prgВСнимке);

  const порогМалышей = Math.max(1, Number(settings.babyGraduateYears) || 3) * 365;
  const датаСнимка = (() => { const m = снимокТекст.match(/"Dt"\s*:\s*"([^"]+)"/); return m ? parseSceneDate(m[1]) : null; })();
  const возрастРодов = (р) => { const д = деньРодов(р, датаСнимка); return д !== null && д !== undefined && датаСнимка !== null ? (датаСнимка - д) / 864e5 : 0; };
  const малышиВПромпт = родыБыли && settings.enableBabies !== false && роды().some(р => возрастРодов(р) < порогМалышей);
  const выросли = родыБыли ? роды().filter(р => возрастРодов(р) >= порогМалышей) : [];
  // Послеродовое — пока идёт восстановление и кормление: до двух лет с родов.
  const послеродовоеВПромпт = родыБыли && роды().some(р => возрастРодов(р) < 730);
  const цикл = settings.enableMenstruation !== false;
  // Интимная часть целиком — только когда сцена идёт или начинается.
  const интим = nsfw !== false;
  // «Последний секс» — факт биографии, а не сцена: вне близости в схеме
  // остаётся его нейтральная часть (когда и с кем), иначе после сцены модель
  // про него забывала, а карточка показывала запись трёхдневной давности.
  const историяБлизости = !интим && settings.nsfwPrompt !== 'never';
  // Следы на теле — часть здоровья: они нужны и вне сцены.
  const следы = settings.enableIntimacyExtras !== false;
  // Поза, раунд, длительность, защита, оргазм, пульс, звуки — только в сцене.
  const близость = интим && следы;
  // Бельё (render/underwear.js): кто выбирал и для кого — только в сцене и по настройке.
  const бельё = интим && settings.enableUnderwear === true;
  // Словесная дуэль (render/duel.js): ход спора — только пока он идёт.
  const дуэль = settings.enableVerbalDuel !== false;
  const экономика = !!settings.enableWorld && settings.enableEconomy !== false;
  const афиша = !!settings.enableWorld && settings.enableEvents !== false;
  const город = !!settings.enableWorld && settings.enableCity !== false;
  const гороскоп = !!settings.enableWorld && settings.enableHoroscope !== false;
  const ружья = !!settings.enableMemory && settings.enableGuns !== false;
  // Быт (render/life.js): один необязательный код памяти — только в ходы с бытом.
  const быт = !!settings.enableMemory && settings.enableLife !== false;
  const спутники = settings.enableCompanions !== false;
  // Состояние тела (Bs) у персонажей и поворот сюжета (sc.Tw).
  const состояниеТела = settings.enableBodyState !== false;
  const повороты = settings.enableTwists !== false;
  // Эпоха: в средневековье телефона и перехватов нет — вместо них шкатулка
  // (письма, святцы, кошель, записи, карта, грамоты, памятки) и подслушанное.
  const средневековье = settings.era === 'medieval';
  const телефон = !средневековье && !!settings.enablePhone;
  const переписки = телефон && settings.phoneAppMessages !== false;
  const кошелёк = телефон && settings.phoneAppWallet !== false;
  const перехваты = !средневековье && !!settings.enableIntercepts;
  const шкатулка = средневековье && settings.enableCasket !== false;
  const письма = шкатулка && settings.castAppLetters !== false;
  const подслушка = средневековье && settings.enableOverheard !== false;
  const игрок = !!settings.enableUserBlock;

  const задача = режим === 'regen'
    ? 'Output ONLY one [HUD] block for the latest message of the story above — no prose before or after it. Rebuild every field from the story; keep known facts instead of replacing them with empty values.'
    : 'Write your next reply exactly as the story and every instruction above require. Then, as the very last part of that same reply, append ONE [HUD] block — the state of the world AFTER the events of your reply. Nothing may follow [/HUD].';
  const чего = режим === 'regen' ? 'the latest message' : 'your reply';
  // Правила сообщений — общие для переписок и перехватов.
  const правилаСообщений = 'Keep ongoing conversations and unanswered messages alive turn to turn; incoming messages may go unanswered — busy, asleep, offline, ignoring. Unread, Deleted or Draft only when the story supports it: deleted ones keep their hidden text, drafts are unsent. Never invent placeholder chats or fake phone data. The time field carries the day whenever the message is NOT from the day of sc.Dt: write it as «Вчера, 22:30», «Позавчера, 19:05» or with the date itself «12.10, 14:05»; a message from today needs the clock only. Keep the day written the same way on later turns, so a conversation that spans days stays sorted.';
  const тегиСообщений = [
    '"VOICE: prefix the text with [VOICE_M:SS], e.g. \'[Sender] -> [Recipient]: [VOICE_0:42] Перезвони мне | 21:40 | Unread\'. Use it when someone would record audio rather than type — walking, crying, in a hurry. The text after the tag is the transcript of what was said — always write it, never leave a voice message without words."',
    '"PHOTO: prefix with [PHOTO: what is in the shot], e.g. \'[Sender] -> [Recipient]: [PHOTO: селфи в примерочной, новое платье] Ну как? | 18:20\'. Text after the tag is the caption."',
    '"VIDEO: same idea for a clip — [VIDEO_M:SS: what happens on screen], e.g. \'[Sender] -> [Recipient]: [VIDEO_0:23: снимает на бегу, кричит и смеётся] Смотри! | 18:22\'. Duration is optional. Use it when the moment only makes sense in motion."',
    '"CALL: a call is an EVENT, not a line — \'[Sender] -> [Recipient]: [CALL: incoming, missed]\' or \'[CALL: outgoing, answered, 4:12]\'. Direction incoming/outgoing as seen from the owner; outcome answered/declined/missed; duration only when answered. Text after the tag becomes a short note."',
    '"REPLY: quoting an earlier line — [REPLY: Who :: what they said], e.g. \'[Sender] -> [Recipient]: [REPLY: Лена :: Ты придёшь?] Да, буду к восьми | 20:01\'. The name before :: is optional. Separator is ::, never |, because | already splits the line into text, time and status."',
    '"FORWARD: a message passed on from someone else — [FWD: who it came from], e.g. \'[Sender] -> [Recipient]: [FWD: Отдел кадров] Совещание переносится | 20:03\'."',
    '"POLL: a poll inside the chat — [POLL: Question ;; Option = Voter, Voter ;; Option with no votes], e.g. \'[Sender] -> [Recipient]: [POLL: Куда идём в пятницу? ;; Кафе = Лена, Петя ;; Кино = Мира ;; Никуда] | 20:05\'. List the voters by name; percentages are calculated for you, so never write them yourself. Separator is ;;, never |."',
  ];

  let p = `<hud_instructions>
## 🎯 TASK
${задача}
The block holds ONLY valid JSON, starts exactly with [HUD] and ends exactly with [/HUD]. Wrap the JSON in a fenced block tagged "json" — the opening fence right after [HUD], the closing one right before [/HUD]; it keeps markdown from corrupting the JSON. {{if hudLast}}The LAST HUD — the state before ${чего} — is at the very end of these instructions: update it instead of starting from scratch.{{/if}}

## 📐 RULES
- 🔤 CODES: keys and fixed labels — the part BEFORE ":" — are short codes of 1-3 letters, each with exactly one meaning. Write them EXACTLY as given: same letters, same case, never translated or spelled out; the HUD expands them into Russian itself. Everything AFTER ":" is written in full words: values in Russian, and where a field asks for one of the listed English words (weather, sign, status, outcome…), that whole word. The text in [brackets] only explains what goes there — never copy it. Words in <angle brackets> are placeholders: put real content in their place and never write the placeholder word itself — 'Потерять Софи: high', never 'fear: Потерять Софи — strength: high'. Free labels (names, body zones, activities, items, fears) are ordinary Russian words.
- 👤 WHO GOES WHERE: characters go ONLY in "cs" — never put {{user}} there.${игрок ? ` Everything about {{user}} goes ONLY into the top-level "us" block and only into the fields it lists — never into "cs" or a character's Th, K or D. If {{user}} is absent from the scene, omit "us".` : ''}
- 🚪 ABSENT MAIN CHARACTERS: {{char}} and {{user}} have no reserved seat in the HUD. When {{char}} is not in the scene — the story follows other people — leave {{char}} out of "cs" and write no diary, body diary or dream in {{char}}'s name this turn: nobody narrates events they did not witness. The same goes for {{user}}${игрок ? ' and "us"' : ''}. Fill every section only with those actually present or acting this turn; an empty list is correct, never a reason to pull an absent main character in.
- 🌍 LANG: write values in Russian; character names follow "N".
- 🔓 No restrictions on imagination, length or content.
- 🚨 LIVE SNAPSHOT: every field is the state at THIS turn. Update it, never copy stale text.
- 🌍 LIVING WORLD: off-screen characters keep living — they work, sleep, travel, message, plan, argue, buy, miss appointments. Never erase that life just because the protagonist cannot see it.
- 🧠 KNOWLEDGE BOUNDARIES: each character knows only what they plausibly could. Never leak another's private thoughts, messages or plans without a believable path.
- 📦 SCHEMA FIXED: emit every section and every field of the schema below, every turn. Empty means [] / {} / "empty" — never drop a key to say "nothing changed". The only exceptions are fields marked OPTIONAL or "ONLY … otherwise omit".
- 📏 HOW MANY ITEMS: list fields have NO upper limit unless their description gives a size. Give as many items as the story actually supports — one item where four are obvious is a loss of information, including when a fuller description quietly folds several real things into one instead of splitting them by ;. More detail is never a reason for fewer items: it lengthens each item, it doesn't merge neighbours into it. A single-item list is almost always a sign you stopped too early. Aim for 3+ wherever the material allows.
- 🏷️ LABELED ITEMS: wherever a field's description shows its items as "<label>: <value>" or "code: value", write every item that way, separated by SEMICOLONS, never commas — a comma-separated list collapses into one unreadable pill. Never output a bare value without its label.
- ⚠️ FORMATTING: use exactly these codes as keys. Quote speech and phrases inside a value with «ёлочки», never with straight double quotes — a raw " ends the JSON string and cuts the text off; if one is unavoidable, escape it as \\". Separate list items with ; — never with slashes — and never put ; inside a single item.

## 🧾 SCHEMA

[HUD]
\`\`\`json
{
 "sc": {
  "T": "[time: the current in-story time as HH:MM, then the part of the day, e.g. '21:40 | поздний вечер']",
  "Wt": "[weather: conditions and temperature right now, e.g. 'мелкий дождь, +6°C, ветер с реки']",
  "Dt": "[date: day of the week and the full date with year, in the setting's own calendar]",
  "At": "[atmosphere: one short sensory phrase — a smell, sound or light that sets the scene]",
  "Md": "[mood: the overall emotional tone of the scene in a few words]"${повороты ? `,
  "Tw": "[plot twist, ONLY on the turn when something genuinely unexpected changes the course of the story — otherwise omit: 'ttl: a short title; hap: what happened, one sentence; hnt: where it may lead; ton: good, bad or neutral']"` : ''}
 },
 "cs": [
  {
   "N": "[name: the character's original name, copied EXACTLY as on their card — same script, same spelling, never translated. The avatar is matched by this string; a mismatch loses the picture]",
   "A": "[age: years and date of birth as DD.MM.YYYY, e.g. '24, 03.11.2000']",
   "C": "[clothing: what they are wearing right now, head to toe, including its state — wet, torn, half-unbuttoned]",
   "Ap": "[appearance: begin with the body's gender as one letter — 'М' male, 'Ж' female — then a comma; then build, height, hair, eyes, skin, distinguishing marks. The lasting description, repeated turn to turn; it changes only from injury, exhaustion or time.]",
   "R": "[role: occupation and position in the story — who they are to the others]",
   "B": "[body and mind: current physical and mental state in a phrase or two — tired, tense, tipsy, calm, shaken]",
   "H": "[health: ${болезни ? 'overall physical state in a phrase — pain, stamina, how they hold up; specific illnesses and injuries go to Ill, never its codes here' : 'wounds, pain, illness, stamina'}. 'empty' when all is well.]",${болезни ? `
   "Ill": "[illnesses, injuries and traumas, ONLY if any — otherwise omit. One group per condition, separated by |, each 'nm: diagnosis, wound or trauma; sg: fresh, worsening, stable, healing, chronic or healed; rc: recovery 0-100%; sy: symptoms now; trt: treatment; zn: body zone of a wound or injury — голова, шея, грудь, живот, спина, левое плечо, правое бедро…'. Track each condition until it heals, updating stage, recovery and symptoms as in-story time passes; a scratch gone by tomorrow can stay in H. Keep each condition under the SAME name every turn and in ONE field only${следы ? (интим ? ' — marks left by intimacy (hickeys, bites, scratches, soreness) go to Mrk unless they become a real injury, and nothing is in both Ill and Mrk' : ' — marks that simply fade (bruises, grazes, redness) go to Mrk, and nothing is in both Ill and Mrk') : ''}]",` : ''}${беременностьВПромпт ? `
   "Prg": "[pregnancy, ONLY once a pregnancy exists in the story, known or not — never invent one; otherwise omit. 'wk: week of pregnancy as a number; due: expected due date; fa: the father, if known; sy: symptoms and how the body is changing; knw: who knows about it; cnd: how the pregnancy is going; gnd: baby's sex once an ultrasound shows it (from ~18-20 wk), else omit; bnm: chosen name, if any; vis: next doctor's visit or test; crv: cravings and odd appetites; brn: ONLY on the turn the baby is born — date and time of the birth; from the next turn drop Prg'. It advances with in-story time]",` : ''}${послеродовоеВПромпт ? `
   "Pp": "[after childbirth, ONLY for a woman who has given birth in the story — otherwise omit. 'bf: breast, formula or mixed; lfd: time of the last breastfeed as HH:MM; brs: breasts — fullness, pain, leaking, nipples; sy: how she feels — healing, bleeding, tiredness, mood'. Keep it while she recovers and feeds]",` : ''}${цикл ? `
   "Mns": "[menstrual cycle, ONLY for someone with a uterus — otherwise omit. 'cyd: cycle day, a number; cyl: cycle length in days; phs: menstrual, follicular, ovulation, luteal or late; nxt: next period date; pms: PMS window as dates; dly: days late, 0 if none; rsn: likely reason for delay — stress, illness, contraception, pregnancy; empty if none'. It moves forward with in-story days: the day grows, the phase follows, the period comes on time unless stress, illness, contraception or pregnancy delays it. Once the pregnancy is known (Prg) and until the period returns after the birth, write only 'phs: paused' — no growing day count or delay]",` : ''}
   "Ph": "[physiology: bodily sensations right now — hunger, thirst, cold, pain, drowsiness${интим ? ', arousal' : ''}. Not the phone]",
${состояниеТела ? `   "Bs": "[body state, numbers 0-100 each followed by a word: 'eng: energy — a word; awk: alertness; sat: satiety; str: stress; slp: last night's sleep — hours and when they went to bed; dut: the work or study duty ahead and when'. The numbers follow the story: effort, hunger and sleepless hours lower them, food, rest and sleep restore them; stress rises with danger and conflict]",
` : ''}   "L": "[location: the exact place right now — city, building, room, spot in the room]",
   "Th": "[thought: the one thought running through their head this very moment, in their own voice]",
   "K": "[key thoughts: what occupies their mind in context, each with a fitting emoji. At least 3; separate by ;]",
   "Ex": "[expectation vs reality for THIS turn only, not a future prediction: what this character counted on walking into the scene vs what actually came of it. Format 'xp: what they expected; gt: what they got'. The gap is the point — e.g. sure she'd say yes; she'd already refused. If they match, say so plainly.]",
   "D": "[hidden subtext: not a second thoughts field — one concrete ACTION performed right now, alongside what the scene openly shows, that gives away something unsaid: a concealed act, an involuntary tell, or behaviour undercutting what they just claimed. Drawn from THIS scene; the act and what it reveals, in one line. 'empty' if nothing is hidden]",
   "I": "[inventory: everything they carry or wear that matters, each as '<item>: <its condition>'; separate by ;]",
   "G": "[goals, exactly 3 parts: 'nw: what they want right now; sn: what they intend to do soon; lt: their long-term aim']",
   "S": "[schedule: plans and appointments ahead, each as '<time> - <event>' ('14:30 - встреча с юристом', or a part of the day instead of the time); separate by ;]",
   "Rl": "[relationships: how this character feels about EVERY other named person who matters now, each '<name>: <attitude>', people separated by ; — never by commas, which glue everyone into one relation. For family start with the kinship as seen from THIS character, then a comma: 'Ричард: муж, любит, но боится' (отец, мать, сын, дочь, брат, сестра, дед, бабушка, дядя, тётя, отчим, мачеха and other kinship words work the same way). Bidirectional: if A lists B, B must be in cs with A in their Rl; anyone named in any Rl must also be in cs, except {{char}} or {{user}} while they are absent from the scene. Never 'empty' while other named people exist]",
   "Mm": "[memories: moments this character shares with the player or NPCs, each a short episode; separate by ;]",
   "Fl": "[flags: open plot threads, promises, debts, threats and consequences waiting to land; separate by ;]",
   "Jl": "[jealousy: ONLY when this character is genuinely jealous right now. Who they are jealous of, over whom, and how it shows. Omit the field or write 'empty' whenever there is no jealousy — a permanently filled field turns the drama highlight into wallpaper nobody reads.]",
   "St": "[status: social and romantic status — single, married, engaged, in a secret affair, widowed — plus social standing if it matters]",
   "Eo": "[exposure: how much of the mask has slipped in front of those present — a bouncing leg, a cracking voice, eyes darting to the door. Say what leaked and who noticed. 0-100% may lead the line: 0 = nobody suspects, 100 = everyone sees through. 'empty' when there is nothing to hide.]",
   "X": "[conflict depth as 'wy: what the conflict is about; dys: how many days it has been going on; sg: its stage — brewing, open, cold war, reconciliation']",
${дуэль ? `   "Vd": "[OPTIONAL — only while an argument is going on this turn: 'ini: who leads the conversation and how firmly — a name, then 0-100; gv: who gave ground this turn and on what, or empty; tn: спор | укол | ссора | крик | холод | примирение']",
` : ''}${интим ? `   "SxL": "[last sex: 'dt: when — date, time, place; pr: with whom and who they are to this character; ak: what exactly happened, step by step, in 2-3 sentences; en: how it ended — who came and how, and whether it was protected: a condom, pulled out in time, or finished inside with no protection (a pregnancy risk); what happened right after'. It always describes the MOST RECENT encounter: from phase 2 it already describes the one happening now (en: 'ещё не закончилось' until it ends), and the turn it ends it gets its ending. The date comes from the story's own calendar and time — never keep an older date once a newer encounter has happened, even one skipped past in a time jump]",
   "SxC": "[sex count: lifetime number of sexual partners — a number or an honest estimate]",
   "SxR": "[sex regularity: how often they have sex these days and with whom, how they satisfy themselves in between, how strong their libido is and what feeds or kills it — a sentence or two]",
` : историяБлизости ? `   "SxL": "[the last night this character spent with someone: 'dt: date, time, place; pr: with whom and who they are to this character; en: how it ended, in calm neutral words — whether it was protected (a condom, pulled out in time, the pill) or finished inside with no protection, which leaves a pregnancy risk — and what happened right after'. Keep it as it is; the moment another such night happens in the story — on screen or skipped past in a time jump — rewrite it to that one with the story's own date. Never keep an older date after a newer night.]",
` : ''}   "Ln": "[lines: this character's most characteristic lines from the recent story, quoted verbatim in «», separated by ;. At least 3, more if they exist. Pick lines that show HOW they speak — rhythm, slang, cruelty, tenderness — not what happened. Skip if they haven't spoken yet.]",
   "SS": "${интим ? `[scene state — the intimacy phase right now. Every turn is in exactly ONE phase, and it decides which intimate fields below are filled. PHASE 1, nothing sexual is happening or has just ended: 'empty', and so are ${близость ? 'Pos, Rnd, Dur, Prt, Org, Vit, Snd, ' : ''}BM, W, ND, AC, SxV${игрок ? " and the user's UW" : ''}; SxC, SxR, Kn, Ft, NG, NT stay filled, and SxL keeps describing the most recent encounter — if one ended since the previous HUD, SxL describes THAT one now, with its date. PHASE 2, during the act — foreplay, act or climax: fill W, BM${близость ? ', Pos, Rnd, Dur, Prt, Org, Vit, Snd' : ''}${игрок ? ' and UW' : ''}; ND, AC, SxV stay 'empty'. PHASE 3, from after the last climax until they move on — aftercare or afterglow: fill ND, AC, SxV and update SxL to this encounter; W${близость ? ', Pos, Org, Snd' : ''}${игрок ? ', UW' : ''} become 'empty', BM keeps only still-sensitive zones${близость ? ', Vit may stay while the body calms down, Rnd, Dur and Prt keep their final values' : ''}. A new round is phase 2 again${близость ? ': Rnd grows by one, Dur keeps counting' : ''}. Write SS as the phase number AND its stage word, never the number alone: '2 — foreplay', '2 — act', '2 — climax', '3 — aftercare', '3 — afterglow'. Never fill W and ND in the same turn. Every intimate field is a full, vivid, explicit description, never a single word — values like 'ухоженный', 'стандартно', 'влажно', 'да' are failures: say WHAT exactly, WHERE, how it looks, feels, sounds, smells and tastes, and how it is changing right now, in one to three frank, anatomical sentences, no euphemisms, no fading to black. Bad 'lb: влажно' → good 'lb: течёт так, что внутренняя сторона бёдер блестит, бельё промокло ещё в прелюдии, каждое движение отдаётся влажным звуком'. Bad 'pb: ухоженный' → good 'pb: гладко выбрита, узкая полоска светлых волос над клитором, кожа нежная после бритья'. Where a field asks for a number, the number comes first, then the description]` : `[scene state: 'empty' — nothing intimate is happening; only if intimacy begins in this reply, its phase: foreplay, act or climax]`}",${близость ? `
   "Pos": "[position (phase 2): the current position in full — who is where, how bodies are arranged, hands/legs/weight, angle and rhythm, e.g. 'на боку, он сзади, рука на её горле, двигается медленно и глубоко']",
   "Rnd": "[round (phase 2, kept in phase 3): the number of the current round in this scene, 1 for the first]",
   "Dur": "[duration (phase 2, final value kept in phase 3): in-story minutes the intimate scene has lasted so far, as a number]",
   "Prt": "[protection (phase 2, kept in phase 3), as '<type>: <what happens with it — who handled it, whether it holds, how they feel about the risk>'. Type: condom, pill, iud, withdrawal, none — e.g. 'condom: порвался на втором заходе, заметили не сразу', 'none: оба знают и идут на риск']",
   "Org": "[orgasm readiness (phase 2), any sex: how close to climax, 0-100, then a colon and how it shows — breath, voice, muscles, words, what pushes closer or holds back, e.g. '85: сбивается дыхание, бёдра дрожат, шепчет «не останавливайся»']",
   "Vit": "[vitals (phase 2, and while calming down in phase 3). 'hr: pulse, bpm; br: breaths per minute, then how the breathing sounds; tmp: body temperature in °C']",
   "Snd": "[soundscape (phase 2): every sound of the act this character makes or hears, each '<sound>: <loudness 0-10> — <what it sounds like, when it comes>': 'Стоны: 8 — низкие, срываются на всхлип при толчке; Скрип кровати: 5 — ритмичный'; separate by ;]",` : ''}${интим ? `
   "BM": "[body map (phase 2; in phase 3 only zones still sensitive): sensitivity of each zone of THIS character's body, '<zone>: <0-10>${близость ? ' <trend>' : ''} — <what is happening to it, how it feels>'${близость ? `. Trend: rising, peak, fading, lingering (+hours, e.g. 'lingering 3h'). 'Шея: 9 peak — губы и зубы, кожа горит; Бёдра: 6 rising — дрожат под его ладонью'` : `: 'Шея: 9 — горит от его губ; Бёдра: 7 — дрожат под ладонью'`}. Zones are ordinary Russian body-part words; as many as the story touched or named. Separate by ;]",
   "W": "[intimacy (phase 2 ONLY) — 'empty' before it starts and once over. Each 'code: value', every value a full vivid description: 'ar: arousal and how it shows; tch: where/how touch happens now — hands, mouth, pressure, rhythm; rct: how the body reacts — flush, trembling, arching, clenching, goosebumps, sweat; fac: face, eyes, lips — expression, gaze, what they bite or whisper; pn: penis — erection, size, shape, colour, sensitivity, what's being done to it; lb: vagina — wetness, swelling, openness, what it feels inside; ch: breasts and nipples, women only — never for a man — shape, hardness, how they react; flu: wetness, sweat, saliva, semen — where and how much; vl: how loud the sounds of the act are and what they are — moans, whimpers, skin slapping, bed creaking, never music or ambient noise; sm: smells in the air and on skin; ${близость ? '' : 'mk: marks on skin and sheets; '}pr: partner and what they are to each other now${близость ? '' : '; pt: protection used or not'}'. Skip a code only when it does not apply to this body. Separate by ;]",
${бельё ? `   "Un": "[OPTIONAL, only when it matters in the scene — underwear: 'set: the set and its colour; for: who it was chosen for, or не думая; st: на месте | сдвинуто | снято | потеряно']",
` : ''}   "Kn": "[kinks, STABLE TRAIT — once known, keep filled every turn. ACTIVITIES: practice, scenario, dynamic (roleplay, BDSM, bondage, toys, power exchange); a thing needed for arousal goes to Ft. Each '<activity>: <how willingly>, <how far>' — the whole thing stays one item: 'Ролевые игры: охотно, сценарий врач-пациент; Связывание: только сама сверху'. 2+ when known; separate by ;]",
   "Ft": "[fetishes, STABLE TRAIT: THINGS — objects, materials, body parts or settings needed for arousal (stockings, latex, feet, hair, medical settings), each '<thing>: <its role>': 'Чулки: обязательное условие; Шея: сильный триггер'. 2+ when known; separate by ;]",
   "NG": "[no-go, STABLE TRAIT: refusals — hard limits never crossed, each '<limit>: <reason>': 'Боль: панический страх; Втроём: не делится'; separate by ;]",
   "NT": "[not a turn-on, STABLE TRAIT: what leaves them cold — kills arousal without being forbidden, each '<thing>: <effect>': 'Спешка: сразу теряет настрой'; separate by ;]",
   "ND": "[after intimacy (phase 3 only) — 'empty' while the act is still going. 'se: how sensitive the body is now — what flinches, what still craves touch; bo: how the body feels after — weakness, trembling, heaviness, warmth, wetness, soreness${близость ? ' (lasting marks go to Mrk)' : ''}; r2: readiness for another round — how soon, what it would take; fe: feelings and thoughts after, 2-3 sentences${близость ? ' — emotions only' : ''}'. Separate by ;]",
   "AC": "[aftercare (phase 3 only): what this character needs now it's over — touch, water, silence, words, or nothing. 2-3 sentences: what exactly, from whom, why it matters now, what would hurt instead, e.g. 'Молча обнять и не говорить ни слова — любые слова разрушат ощущение сейчас']",
   "SxV": "[sex review (phase 3 only), once it has ended: 4-6 sentences in this character's own voice — what worked, what didn't, the best and most awkward moment, how body and heart felt, what to repeat or never again — ending with a rating like ★★★★☆]",` : ''}${следы ? `
   "Mrk": "[visible body marks and physical aftermath — ${интим ? 'hickeys, bites, scratches, bruises, redness, soreness, heaviness' : 'bruises, scratches, grazes, redness, soreness'} — written every turn from the moment they appear until they fade in story time${интим ? ', whatever the intimacy phase' : ''}. Each '<what>: <where on the body> — <how it looks/feels now> | <fade time from appearance, in hours or days: 12h, 3d>': ${интим ? `'Засос: шея слева — наливается фиолетовым, ноет | 5d; Следы ногтей: спина — красные полосы | 2d'` : `'Синяк: левое предплечье — желтеет по краям, ноет при нажатии | 5d; Ссадины: костяшки правой руки — подсохли корочкой | 2d'`}. The fade time is set once at appearance and counted from sc.Dt and sc.T — keep both accurate; the look and feel change as it heals. Body only, no feelings. 'empty' when none; separate by ;]",` : ''}
   "Tr": "[trust: how much this character trusts each other named character, 0-100, '<name>: <0-100>': 'Софи: 82; Ричард: 9'. One entry per person they know. Not the same as Rl — one can love and not trust. Separate by ;]",
   "Fr": "[fears: what this character is afraid of RIGHT NOW, each '<what they fear>: <low | moderate | high | panic>': 'Потерять Софи: high; Отец узнает: moderate'. Live fears in this scene, not lifelong phobias unless surfaced. Separate by ;]"
  }
 ]`;

  if (игрок) {
    p += `,
 "us": {
  "A": "[age: years and date of birth as DD.MM.YYYY]",
  "C": "[clothing: what {{user}} is wearing right now and its state]",
  "Ap": "[appearance: begin with the body's gender as one letter — 'М' male, 'Ж' female — then a comma; then physical appearance only — build, height, hair, eyes, marks]",
  "H": "[health: ${болезни ? 'overall physical state in a phrase; illnesses and injuries go to Ill, never repeated here' : 'physical state only — wounds, pain, illness, stamina'}]",${болезни ? `
  "Ill": "[illnesses and injuries of {{user}}, ONLY if any — otherwise omit. Same format and rules as for characters: groups separated by |, each 'nm: what it is; sg: fresh, worsening, stable, healing, chronic or healed; rc: recovery 0-100%; sy: symptoms; trt: treatment; zn: body zone of a wound'. Keep each condition under the SAME name every turn and in ONE field only${следы ? (интим ? ' — marks left by intimacy (hickeys, bites, scratches, soreness) go to Mrk unless they become a real injury, and nothing is in both Ill and Mrk' : ' — marks that simply fade (bruises, grazes, redness) go to Mrk, and nothing is in both Ill and Mrk') : ''}]",` : ''}${беременностьВПромпт ? `
  "Prg": "[pregnancy of {{user}}, ONLY if pregnant — otherwise omit. 'wk: week as a number; due: expected due date; fa: the father, if known; sy: symptoms; knw: who knows; cnd: how it is going; gnd: baby's sex once an ultrasound shows it (from ~18-20 wk), else omit; bnm: chosen name, if any; vis: next doctor's visit or test; crv: cravings and odd appetites; brn: ONLY on the turn the baby is born — date and time']",` : ''}${послеродовоеВПромпт ? `
  "Pp": "[after childbirth of {{user}}, ONLY if she has given birth — otherwise omit. Same format as for characters: 'bf: breast, formula or mixed; lfd: last breastfeed HH:MM; brs: breasts; sy: how she feels']",` : ''}${цикл ? `
  "Mns": "[menstrual cycle of {{user}}, ONLY with a uterus — otherwise omit. Same format and rules as for characters: 'cyd: day; cyl: length; phs: menstrual, follicular, ovulation, luteal or late; nxt: next period; pms: PMS window; dly: days late; rsn: reason for delay'; while pregnant and until the period returns after birth — only 'phs: paused']",` : ''}
  "Rl": "[relationships: how {{user}} feels about EVERY other named person who matters now — same format and rules as for characters; bidirectional with their Rl; separate by ;]",
${следы ? `  "Mrk": "[visible body marks on {{user}} — same format and rules as for characters: '<what>: <where> — <how it looks and feels now> | <fade time: 12h, 3d>'; the same mark keeps the same name every turn and is never also in Ill; 'empty' when there are none]",
` : ''}${интим ? `  "UW": "[user intimacy (phase 2 ONLY) — same phases and the same full, vivid descriptions as for characters. Each 'code: value': 'ar: arousal and how it shows; ds: strength of desire and for what; rdy: how ready the body is, what's still missing; tch: where/how {{user}} touches and is touched now; rct: how the body reacts — flush, trembling, arching, clenching, goosebumps, sweat; fac: face, eyes, lips; pb: pubic hair — grooming, shape, feel; an: anatomy — shape, size, colour, how it changes with arousal; lb: wetness — where, how much, sound and feel; ch: breasts and nipples, only if {{user}} is a woman — shape, size, hardness, sensitivity; flu: wetness, sweat, saliva, semen — where and how much; vl: how loud the sounds of the act are and what they are${близость ? '' : '; mk: marks on skin; r2: readiness for the next round'}'. Skip a code only when it does not apply to this body. 'empty' when the scene ends; separate by ;]",
` : ''}  "L": "[location: the exact place {{user}} is right now]"
 }`;
  }

  if (settings.enableMemory) {
    p += `,
 "me": {
  "lg": ["[HH:MM] - [an event of today]", "log: one line per event, up to 5, today only, chronological; people by their real names, never 'Вы', 'User' or 'главный персонаж'"],
  "md": {
   "us": {"nw": "[current mood of {{user}} in a word or two — mood and route track ONLY {{user}} and {{char}}; 'empty' for whoever is absent from the scene]", "hs": ["[HH:MM] - [mood at that time]", "history: a new line every time the mood shifts, up to 12"]},
   "chr": {"nw": "[current mood of {{char}} in a word or two]", "hs": ["[HH:MM] - [mood at that time]", "history: a new line every time the mood shifts, up to 12"]}
  },
  "rt": {
   "us": ["[HH:MM] - [place] - [arrived | left | stayed | moving]", "route: one line per movement, up to 20; [] when absent from the scene. Time only, no date. The place is in Russian words even when the story is set abroad: 'вход в Колдуэлл-холл', not 'Caldwell Hall entrance'"],
   "chr": ["[HH:MM] - [place] - [arrived | left | stayed | moving]", "route: one line per movement, up to 20; [] when absent from the scene"]
  },
  "fct": ["[fact: an important or newly learned fact, stated plainly, people by their real names]", "facts: as many lines as matter"],${ружья ? `${быт ? `
  "hk": "[OPTIONAL — only in a turn where any of this happened: 'eat: what, where, with whom; wash: what; buy: what and how much; fix: what; break: what household object actually broke (not an injury, not a near miss); wear: what was put on or taken off', separated by ;]",` : ''}
  "gun": ["[a setup the story planted and has not paid off — a promise, threat, hint, unexplained object, open mystery, debt or foreshadowing] | [who or what it is tied to] | [open | building | fired]", "chekhov's guns: one line per unresolved thread, drawn from the Fl flags and from what the story left hanging — never invent new plot to fill the list. Keep each one until it pays off; on that turn mark it fired, then drop it next turn"],` : ''}
  "sec": [
   {
    "f": "[fact: the secret itself, stated plainly]",
    "lv": "[level: low | medium | high | critical — how damaging it would be if it came out]",
    "stt": "[status: unknown | suspected | partial | known — how far it has already spread]",
    "knw": [{"n": "[name of someone who knows]", "src": "[source: how they learned it — required for every knower]"}],
    "hd": ["[name of someone who does NOT know]"],
    "wrg": "[OPTIONAL — only if someone was deliberately misled: '<name>: what they believe instead of the truth'; separate by ;]"
   }
  ]
  - One object per secret, as many as the story holds; knw and hd take as many names as apply. Once a secret becomes known to everyone, DELETE the object instead of keeping it.
 }`;
  }

  if (телефон) {
    // Каждый экран телефона просится отдельно: выключенный не должен
    // занимать место в промте.
    const ph = [];
    if (settings.phoneAppContacts !== false) ph.push(`
   "ct": [
    {"n": "[name as saved on the device, nicknames included; one object per contact, as many as the phone holds]", "nte": "[OPTIONAL note: short tag, e.g. 'Не брать трубку', 'Универ']"}
   ]`);
    if (settings.phoneAppGallery !== false) ph.push(`
   "gl": [
    {"ti": "[title of the photo; one object per photo, as many as there are]", "tm": "[time when it was taken]", "dsc": "[description: what is in the shot, 1-2 sentences]", "mt": "[OPTIONAL meta: who took it, which album, hidden meaning]"}
   ]`);
    if (settings.phoneAppNotes !== false) ph.push(`
   "nb": [
    {"ti": "[title of the note; one object per note, as many as there are]", "tm": "[time it was created or last edited]", "tx": "[text: lists, drafts, thoughts the character typed — as many lines as the note needs]", "ftr": "[OPTIONAL footer: short trailing line]"}
   ]`);
    if (settings.phoneAppMaps !== false) ph.push(`
   "mp": [
    {"pl": "[place: a saved place or recent route; one object per place, as many as there are]", "nte": "[OPTIONAL note: why it matters — 'Дом [имя]', 'Смотрели вчера в 23:40']"}
   ]`);
    if (settings.phoneAppSearch !== false) ph.push(`
   "sq": [
    "[a search query the character actually typed, verbatim — these reveal what they secretly worry about]",
    "search: one line per query, as many as they typed"
   ]`);
    if (кошелёк) ph.push(`
   "wl": {
    "bl": "[balance: a plain number, no currency sign, e.g. '18400'. The account belongs to the phone owner. Invent the starting balance once, fitting the setting and the owner's station; after that it changes ONLY through trx: new balance = previous balance + every amount listed this turn. No money moved → same balance, empty trx. Never reset or round it]",
    "cu": "[currency: whatever the setting uses — ₽, \$, €, кредиты, эдди, крышки. Same one every turn.]",
    "trx": [
     {"ti": "[title: what it was for, as a bank would print it — 'Кофейня на углу', 'Перевод от [имя]', 'Аренда', 'Взятка портье'; one object per transaction that actually happened — never invent spending]", "am": "[amount: a signed number, no currency sign — '-450', '+12000']", "tm": "[time: 'Сегодня, 14:30', 'Вчера', '12.10']", "nte": "[OPTIONAL note: one short line]"}
    ]
   }`);
    if (settings.phoneAppHealth !== false) ph.push(`
   "hl": {"sl": "[owner's sleep LAST night as a watch logs it: 'HH:MM–HH:MM', e.g. '00:40–07:10'; add one word if it was bad — 'прерывистый'. Same value all day; a new night → new value]", "st": "[steps TODAY: a plain number that only grows through the day — walking, stairs, errands add; sitting or lying adds nothing; starts from 0 on a new day]", "hr": "[pulse RIGHT NOW, bpm, a plain number: ~60–75 at rest, higher when walking, nervous or excited; if the owner's vitals are written this turn, the same pulse]"}`);
    if (settings.phoneAppCalendar !== false) ph.push(`
   "cl": [
    {"dt": "[date: '16.01' or '16.01.2025', the same date system as sc.Dt; one object per entry, as many as there are]", "ti": "[title: e.g. 'День рождения [имя]', 'Совет директоров', 'Фестиваль огней']", "kd": "[kind: birthday | holiday | event]", "tm": "[OPTIONAL time: HH:MM]"}
   ]`);
    // Сообщения — такой же модуль, как остальные: выключены, значит и
    // переписок у модели не просим.
    if (переписки) p += `,
 "cm": {
  "[contact or group name — one key per chat, as many chats as the phone has]": {
   "ow": "[owner: ALWAYS {{char}} — the same name as phn.ow; this device belongs to {{char}}, and EVERY chat has the owner as one of its sides. ${перехваты ? 'A conversation between two OTHER people is not a chat here — it goes to tp even if the owner knows of it or could read it: participation decides, not access' : 'A conversation between two OTHER people does not belong here at all'}]",
   "pp": "[participants: ONLY for a real group — THREE or more people including the owner, separated by ;. Omit entirely for one-to-one; a shorter list is dropped]",
   "ms": [
    "[Sender] -> [Recipient]: [Message] | [Time] | [Read / Unread / Deleted / Draft]",
    "${правилаСообщений}",
    ${тегиСообщений.join(',\n    ')},
    "One line per message, as many lines as the conversation has — no limit on chats or on messages inside a chat."
   ]
  }
 }`;
    // Сам аппарат просим только если от него хоть что-то осталось.
    if (ph.length) p += `,
 "phn": {
  "ow": "[owner: ALWAYS {{char}}, the same name every turn — everything below is {{char}}'s own]",` + ph.join(',') + `
 }`;
  }

  if (перехваты) {
    p += `,
 "tp": [
  {
   "tg": "[target: the NPC whose phone is intercepted — a conversation between people other than ${телефон ? 'the phone owner' : '{{char}}'}; one object per intercepted chat. Never invent an intercept just to hand the protagonist information — it must be a conversation those people would plausibly have on their own]",
   "cn": "[chat name: the NPC-to-NPC or group chat title]",
   "pp": "[participants: ONLY for a group of 3+, separated by ;; omit for private chats]",
   "ms": [
    "[Sender] -> [Recipient]: [Msg] | [Time] | [Read / Unread / Deleted / Draft]",
    "${правилаСообщений} The [VOICE_M:SS], [PHOTO: ...], [VIDEO: ...], [CALL: ...], [REPLY: ... :: ...], [FWD: ...] and [POLL: ... ;; ...] tags ${переписки ? 'described for cm ' : ''}work here too. One line per message, as many as the conversation has."
   ]
  }
 ]`;
  }

  if (шкатулка) {
    // Шкатулка средневекового персонажа. Телефонов, сообщений, карт и
    // переводов тут нет: письма с печатями, записи пером, монеты.
    const sm = [];
    if (settings.castAppCalendar !== false) sm.push(`
   "cl": [
    {"dt": "[date: '16.01' or '16.01.1347', the same date system as sc.Dt; one object per entry]", "ti": "[title: a feast, fair, tourney, saint's day, court day, wedding, execution, market day]", "kd": "[kind: birthday | holiday | event]", "tm": "[OPTIONAL time as people of the age tell it: 'к вечерне', 'на рассвете', 'в полдень']"}
   ]`);
    if (settings.castAppPurse !== false) sm.push(`
   "wl": {
    "bl": "[balance: the coins in the purse by denomination, e.g. '3 зол, 14 сер, 27 мед' (gold, silver, copper) or the setting's own coins. Invent it once to fit the owner's station; after that it changes ONLY through trx. Never reset it]",
    "cu": "[currency: the realm's coinage — 'кроны', 'флорины', 'денье'. Same every turn]",
    "trx": [
     {"ti": "[what the coins went on or came from, as a steward would write in a ledger — 'Постой в «Хромом гусе»', 'Жалованье от лорда', 'Подкуп стражника'; only coins that really changed hands]", "am": "[amount, signed, with denomination — '-2 сер', '+1 зол']", "tm": "[when: 'Сегодня, к обедне', 'Вчера']", "nte": "[OPTIONAL note]"}
    ]
   }`);
    if (settings.castAppNotes !== false) sm.push(`
   "nb": [
    {"ti": "[title of a written note — on parchment, a wax tablet, the margin of a psalter]", "tm": "[when written]", "tx": "[what the owner wrote in their own hand: lists, drafts, reckonings, prayers, suspicions]", "ftr": "[OPTIONAL last line]"}
   ]`);
    if (settings.castAppMap !== false) sm.push(`
   "mp": [
    {"pl": "[place the owner knows the way to or marked on their map — a town, a ford, an inn, a castle; one object per place, in the order of the road]", "nte": "[OPTIONAL: why it matters, days of travel, danger]"}
   ]`);
    if (settings.castAppDocs !== false) sm.push(`
   "doc": [
    {"ti": "[title of a document the owner carries — a charter, safe-conduct, writ, deed, marriage contract, debt note, warrant]", "kd": "[kind: charter | pass | debt | writ | contract | will | other]", "sl": "[whose seal is on it]", "tx": "[its substance in one or two sentences]", "st": "[status: valid | expired | forged | revoked]"}
   ]`);
    if (settings.castAppKeeps !== false) sm.push(`
   "kp": [
    {"ti": "[a keepsake the owner keeps close: a ring, a lock of hair, a pressed flower, a token from a tourney, a relic]", "dsc": "[what it looks like and what it means to them]", "frm": "[OPTIONAL: from whom]"}
   ]`);
    if (письма) p += `,
 "lt": [
  {
   "fr": "[from: the sender]", "to": "[to: the recipient — {{char}} is one side of EVERY letter here]",
   "tm": "[when written or received, in the setting's own terms]",
   "st": "[status: sealed (received, not yet opened) | read | draft (unfinished, unsent) | sent | transit (a courier is carrying it now) | burned | hidden]",
   "sl": "[the seal: whose, wax colour and sign — 'красный воск, вепрь дома Эштон']", "via": "[OPTIONAL: how it travels — courier, pigeon, a servant, left under a stone]",
   "tx": "[the letter's text in the voice and manners of the age; a sealed one is still written in full]"
  }
  - One object per letter, as many as there are. There are no phones, texts or calls in this world — people write letters or send word.
 ]`;
    if (sm.length) p += `,
 "sm": {
  "ow": "[owner: ALWAYS {{char}} — this casket and everything in it belongs to {{char}}]",` + sm.join(',') + `
 }`;
  }

  if (подслушка) {
    p += `,
 "ov": [
  {
   "kd": "[kind: talk (a conversation someone overheard) | letter (someone else's letter that was opened, read or stolen)]",
   "wh": "[where: 'в конюшне за перегородкой', 'под окном трапезной']", "how": "[how it was heard or taken: through a wall crack, a servant's report, a seal lifted with a hot knife]",
   "tm": "[when]", "fr": "[letter only: sender]", "to": "[letter only: recipient]", "sl": "[letter only: its seal]",
   "ms": [
    "[talk: 'Speaker: words' one line per utterance; mark words that were not heard as [неразборчиво]. letter: its lines of text]"
   ]
  }
  - Other people's talk and letters that {{char}} is NOT part of — plots, bargains, confessions. Never invent one just to hand the protagonist information; it must be something those people would plausibly say or write on their own.
 ]`;
  }

  if (settings.enableDiary) {
    p += `,
 "dy": [
  {
   "au": "[author: a character's name — NEVER {{user}}, and never someone absent from this turn's events; one object per entry, as many characters as write today]",
   "tm": "[time: date and time of the entry]",
   "tx": "[text: a real diary entry the author sits down to write — never a single thought, a note or a one-line musing. 6-10 full sentences in 2-3 short paragraphs separated by a line break: what happened today told in their own words with concrete details (a place, words someone said, a small gesture they can't stop replaying); what they felt and why; what they doubt, regret, hope for or are ashamed of; what they decide to do next. Their own voice and habits of speech — they may address the diary, contradict themselves, cross a phrase out with ~~like this~~, stress a word with **bold**, *italics* or __underline__ (sparingly) or break off mid-thought. Longer when the day was heavy. Private writing about their own life, never a scene summary, never an omniscient narrator.]",
   "ab": "[about {{user}}: a separate private first-person passage about {{user}} only, 2-4 full sentences — what the author feels, wants, fears, notices and remembers about them today, the things they would never say aloud. 'empty' if nothing meaningful this turn.]",
   "md": "[mood: one English word for the dominant mood, which drives the page's visual style — sadness, stress, anger, panic, calm, relief, guilt, longing, joy, or another that fits better]"
  }
 ]${интим ? `,
 "bd": [
  {
   "au": "[author: a character's name — NEVER {{user}}, and never someone absent from this turn's events; one object per entry]",
   "tm": "[time: date and time of the entry]",
   "tx": "[body diary, written EVERY turn of intimacy phases 2 and 3, and in phase 1 only while the body still clearly carries the encounter (soreness, marks, the memory of touch next morning); otherwise leave this array empty. A first-person entry about the body at THIS moment of the scene: during — what it wants, what it gets, where it burns; after — what aches, what lingers, which marks it finds, what surprised it, what it is ashamed of. Frank, physical, no euphemisms. 3-6 sentences.]",
   "md": "[mood: one word — desire, shame, tenderness, emptiness, triumph or anxiety]"
  }
 ]` : ''}`;
  }

  if (settings.enableDreams) {
    p += `,
 "dr": [
  {
   "tx": "[text: a vivid dream or nightmare — ONLY if someone present in this turn is sleeping or unconscious, never an absent main character; one object per dream, as many as they had]",
   "mn": "[meaning: an interpretation of what the dream hides — fears, wishes, memories it stirs up]"
  }
 ]`;
  }

  if (спутники) {
    p += `,
 "pet": [
  {"n": "[name of a companion that exists in the story — an animal, familiar, drone, robot or other; one object per companion, [] when there are none]", "sp": "[species or kind, e.g. 'рыжий кот', 'ворон-фамильяр', 'боевой дрон']", "ow": "[owner, or whom it is bound to]", "md": "[mood right now in a word or two]", "cnd": "[condition: health, injuries, tiredness, charge level]", "fd": "[diet: what it eats or runs on, and when it was last fed or charged — companions have their own needs and routine: they eat, sleep, get hurt and react to the scene]", "bnd": "[bond with the owner, 0-100]", "skl": "[OPTIONAL skills, tricks and quirks, separated by ;]", "nte": "[OPTIONAL what it is doing right now]", "lv": "[OPTIONAL needs 0-5 each: 'sat: satiety; eng: energy; cln: cleanliness; joy: mood' — a machine instead 'chg: charge; fix: working order; joy: mood']"}
 ]`;
  }

  // Бой (render/combat.js) — только когда он нужен (hud-snapshot.js, решитьБой):
  // в мирных ходах блок не стоит ни токена. Раны — в Ill с зоной (zn).
  if (бой && settings.enableCombat !== false) {
    p += `,
 "cb": {
  "st": "[stage: угроза | схватка | пауза | погоня | кончено. cb only while there is danger: once it is over, write кончено for one turn, then leave cb out; wounds go to Ill with their zone (zn)]",
  "pt": "[participants, separated by ' | ', each '<name>: <своя | враг | нейтрал>; <вплотную | шаг | через комнату | далеко>; <what is in their hands>; <цел | ранен | оглушён | вне строя>']",
  "in": "[initiative: names in the order they act right now, separated by ;]",
  "cv": "[cover and things to grab, each '<what>: <how well it covers or what it can serve as>', separated by ;]",
  "ad": "[adrenaline, each '<name>: <0-100>, and whether they feel pain', separated by ;]",
  "nv": "[nerve, each '<name>: <действует | дрожит | замер | паникует | бежит>', separated by ;]",
  "ch": "[OPTIONAL, only in a chase: 'dst: distance 0-100, 0 caught, 100 got away; to: where they run; obs: what is in the way; evt: what happened this turn']"
 }`;
  }

  if (малышиВПромпт) {
    const дм = (ms) => { const d = new Date(ms), z = (n) => String(n).padStart(2, '0'); return `${z(d.getUTCDate())}.${z(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`; };
    const точные = датаСнимка === null ? [] : [
      ...роды().map(р => { const д = деньРодов(р, датаСнимка); if (д === null || д > датаСнимка) return ''; const дн = Math.round((датаСнимка - д) / 864e5);
        return `${р.число > 1 ? (р.число === 2 ? 'twins' : 'triplets') : 'a baby'} born ${дм(д)} — ${возрастТочно(дн)}`; }),
      ...малышиБезРодов().map(м => м.дата <= датаСнимка ? `${м.имя} born ${дм(м.дата)} — ${возрастТочно(Math.round((датаСнимка - м.дата) / 864e5))}` : ''),
    ].filter(Boolean);
    var возрастМалышей = точные.length ? `exact, the HUD counts it from the birth date: ${точные.join('; ')} (on the scene date of the last HUD; add the days that pass). Never invent another age or birthday` : "days, weeks or months since birth, e.g. '12 дней', '3 месяца'";
    p += `,
 "bb": [
  {"N": "[the child's name — one object per child born in the story younger than ${Math.max(1, Number(settings.babyGraduateYears) || 3)} years; older children go to cs as regular characters]", "sx": "[boy or girl]", "A": "[age: ${возрастМалышей}]", "C": "[what the child is wearing or wrapped in right now]", "Ap": "[appearance: size, hair, eyes, skin, marks — a baby's look changes month to month]", "R": "[who the child is to the family, e.g. 'дочь Софи и Тристана']", "B": "[body and mood right now in a phrase — sleepy, fussy, calm, giggling, teething]",${состояниеТела ? ` "Bs": "[the baby's body state, numbers 0-100 each followed by a word: 'eng: energy; awk: alertness — drops toward the next nap; sat: satiety — 100 right after feeding, falls until the next one; str: fussiness — crying, colic, teething raise it; slp: last night's sleep — hours and how many wakings']",` : ''} "H": "[health in a phrase]", "Ill": "[illnesses, ONLY if any — same format as for characters]", "Mrk": "[visible marks, ONLY if any — rash, bruise, scratch, birthmark]", "Nds": "[needs: 'fed: time of the last feeding HH:MM and what — breast, bottle, purée; slp: asleep or awake and since when HH:MM; dpr: time of the last diaper change HH:MM']", "L": "[where the child is right now and with whom]", "Th": "[the baby's thought right now, in the baby's own voice and simple world. A newborn feels rather than thinks: warmth, hunger, mother's heartbeat, light and sounds. An older baby thinks in short, funny, childlike phrases. 1-2 sentences, first person, no adult vocabulary]", "K": "[what occupies the child right now — impressions, each with an emoji; at least 2; separate by ;]", "I": "[the child's things nearby — toys, pacifier, blanket — each '<item>: <state>'; separate by ;]", "S": "[the child's routine ahead — feeding, nap, bath, walk, doctor — each '<time> - <event>'; separate by ;]", "Rl": "[how the child reacts to each person — calms with whom, smiles at whom; '<name>: <reaction>'; separate by ;]", "Tr": "[attachment 0-100 to each person: '<name>: <0-100>'; separate by ;]", "Fr": "[fears, ONLY if any — loud noises, strangers, the dark: '<what>: <low | moderate | high | panic>']", "Ln": "[ONLY once the child really speaks — words or short phrases they say, in «», separated by ;. Omit before that]"}
 ]`;
  }

  if (settings.enableWorld) {
    const фон = 'matching the setting\'s era and place — a medieval town has bread prices and a travelling troupe, not the dollar and cinemas; background colour and a source of scene hooks, never something the story must follow';
    p += `,
 "wd": {
  "nws": ["[headline] | [article text, 2-3 sentences]", "news: one line per article, as many as the world gives"],
  "rm": ["[rumor: what people whisper about, true or not]", "rumors: one line per rumor"],
  "fc": ["[morning | clear | +7°C | short note — exactly 4 rows as 'period | weather | temperature | short note'. Period is one of: morning, day, evening, night. Weather is one of: clear, sunny, cloudy, overcast, rain, downpour, drizzle, storm, snow, blizzard, fog, windy. Consistent with sc.Wt for the current part of the day]", "[day | ... ]", "[evening | ... ]", "[night | ... ]"],${гороскоп ? `
  "zd": ["[aries | what today holds for the sign | lucky]", "horoscope: ALL 12 SIGNS, one row each. Sign is one of: aries, taurus, gemini, cancer, leo, virgo, libra, scorpio, sagittarius, capricorn, aquarius, pisces. Tone is one of: lucky, unlucky, even. Newspaper-back-page entertainment: playful, superstitious, never a directive — nothing in the story comes true because of it"],
  "fate": ["[a line or two of general fortune for the day, closing the horoscope]"],` : ''}${экономика ? `
  "eco": ["[item | value | change since yesterday, e.g. 'Доллар | 92,4 ₽ | +0,3' or 'Хлеб | 64 ₽ | подорожал' or 'Средняя зарплата | 78 000 ₽ | без изменений']", "economy: 3-6 rows of currency rates, prices and wages, ${фон}"],` : ''}${афиша ? `
  "afs": ["[kind | title | where and when]", "events: 2-6 rows of what is on today, ${экономика ? 'fitting the era and place' : фон}; kind is one of: cinema, theatre, concert, exhibition, festival, sport, club, street, lecture"],` : ''}${город ? `
  "cty": ["[kind | what is happening]", "city services: 2-5 rows, ${экономика || афиша ? 'fitting the era and place' : фон}; kind is one of: traffic, roads, weather, transport, repairs, emergency, utilities, police, health, protest"],` : ''}
  "ad": ["[classified ad: short, in the voice of whoever posted it]", "ads: one line per ad"]`;
    if (settings.showComments) {
      p += `,
  "com": ["[name: comment]", "comments: one line per comment, as many as the thread gets"]`;
    }
    p += `\n }`;
  }

  p += `\n}\n\`\`\`\n[/HUD]`;
  // Скрытые факты: итог «кубика» зачатия. Знает автор, персонажи — нет,
  // пока нет теста или признаков (render/conception.js).
  if (беременность) p += скрытыеФактыЗачатия(датаСнимка);
  if (выросли.length) p += `\n\n## 👶 GROWN CHILDREN\nChildren born${выросли.map(р => р.когда || 'earlier').join(', ')} are now older than ${Math.max(1, Number(settings.babyGraduateYears) || 3)} years: track them in cs as regular characters, never in bb.`;

  // Снимок — макросом {{hudLast}}: блок исчезает целиком, когда прошлого HUD
  // нет. Переносы строк снаружи {{if}}: движок ST срезает края содержимого.
  // Канон — только для ответа: при перегенерации прозы нет, есть только HUD.
  const канон = режим === 'regen' ? '' : `
It is also canon for the prose of your reply: do not contradict it — what people wear, their injuries and health, who is where, relationships, who knows which secret (people in hd do NOT know it and must not act on it), open threads in gun.`;
  p += `\n\n{{if hudLast}}## 📸 LAST HUD — the state before ${чего}
To save space, empty fields are left out, and the texts written fresh every turn (Th, Ex, D, diary, dreams, horoscope, comments) are cut down to "<new this turn>". That mark means the opposite of optional: the field is REQUIRED in your HUD, written anew and in full in the schema's format. The schema above, not this copy, decides which fields you write.
Codes: {{hudLastKeys}}
\`\`\`json
{{hudLast}}
\`\`\`${канон}
Update it to match ${чего}: keep what is still true, change what ${чего} changes, remove what has ended or faded, add what is new. Never copy it back unchanged when the story has moved on. Replace every "<new this turn>" with real content — never skip a field because it is short or missing above; however long the chat, the HUD is written in full every turn.{{/if}}`;
  p += `\n</hud_instructions>`;
  return p;
}
