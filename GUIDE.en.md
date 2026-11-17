# TavernOS HUD guide

## How it works

TavernOS asks the model to send a `[HUD] … [/HUD]` block with every reply — compact JSON with short English codes. The extension parses it and draws a card with tabs under the message: characters, you, phone, memory, everyday life, world, combat, diaries, dreams, companions and more.

- **The block stays in the reply text.** The card is drawn on top of it; without the extension the block is simply visible as text.
- **The model's instruction is built from the enabled blocks.** Turn a block off and it disappears both from the screen and from the request, so it stops costing tokens.
- **Old HUDs in the history are squeezed into summaries** `[HUD_SUMMARY]`, so the history does not grow with every turn. Only the latest one stays expanded (configurable).
- **The model writes codes, you see words.** `sc` is the scene, `cs` the characters, `Ap` the appearance: codes save tokens, and the screen shows full names in your language.
- **HUD has no servers of its own.** Everything goes only through your connection in SillyTavern and is stored on the Tavern server.

## Quick start

1. Install the extension: **Extensions → Install extension**, address `https://github.com/alewwi/HUD`.
2. Open the **📊 TavernOS** settings in "Extensions". The language is in **✨ Look and language → 🌐 Язык / Language**.
3. In **🚀 Quick start**, pick the world, how much HUD (light, normal or full), 18+, which model you use and how the HUD appears. Each choice applies a ready set; every item has a **?** with an explanation, and the search at the top finds any setting. Single blocks are in **🧩 What the HUD shows**: the fewer blocks, the cheaper each reply and the more attentive the model is to the rest. Each block shows how many tokens it costs.
4. Send a message. A card appears under the reply. If it does not — see "Problems and fixes".
5. Looks live in the **🎨 Customization** window: theme, fonts, colors, the view of every block.

> For a first chat, characters, memory and world are enough. Turn on the rest as you need it — every tab has a question mark with an explanation.

## The card: how to read it and what to press

### Header
- **Scene** — time, date, weekday, time of day, weather and moon. Tap it to animate the weather.
- **Token chip** — how much the HUD instruction costs; tap to see the breakdown by block.
- **Plot twist** — the "TWIST" plate with what happened and where it may lead. A hint, not an order.
- **Fold** — the card can be folded into a strip with time and weather.

### Tabs
- Every tab has a question mark: what it is, why it appeared and how to read it. Fields and sections inside tabs have them too.
- Character tabs are named after the characters. Tab icons can be changed in Customization.
- Tabs that take long to build (relationship graph, family tree, archive) are built when first opened.

### Card buttons
- **🔄 Regenerate HUD only** — rewrite the HUD block of this reply without touching the reply itself.
- **Regenerate phone only** — rewrite just the phone.
- **➕ Create HUD** — in a message without a block: generate it from scratch and stitch it in.
- **✎ Fix** — press it, then a line in the card: you can correct a field, a stat, the scene time, date and weather.
- **🗑 Remove plates** — turns on delete mode: tap a plate and confirm. This removes a wrong entry without touching the rest.
- **Open in the side panel** — this turn's HUD in the side panel.
- **Turn summary** — old messages show a short summary instead of the full HUD; tap it to open the full one. If the HUD was offloaded to a file, the button brings it back into the message.
- **❓ Ask about the story** — the assistant answers from the HUD and the latest messages; nothing goes into the chat.
- **One-time hints** — plates you can tap so that a single request goes to the model with the next reply. It goes with the next reply: a swipe of the reply where you tapped does not get it, swipes of the next one do.

### Building up
When something piles up over several days — lack of sleep, hunger, stress through the roof, a negative balance, a gun past its deadline — the HUD sees where it is heading and puts a **⚡ Building up** plate in that person's card: what may happen and why.
- **Tab badge.** The person's tab shows a number: how many such things wait for your decision. A gun that involves several people shows up for each of them.
- **"Suggest to the model"** sends it to the model once, with the next reply. **"No thanks"** removes the plate, and it is not offered again.
- **Guns.** A gun due "15.06" does not go off on the 15th itself, only from the next day. If the model has already marked it fired or removed it, the plate disappears at once.
- Turned on and off by **⚡ Consequences** in "🧩 What the HUD shows".

### Holidays
- The phone calendar shows the holidays of your era and, with **✨ World holidays** on, the world's own holidays from the fandom or the lorebook: the model finds them or makes them up.
- Tap **"How it is celebrated"** on a holiday and the model comes up with a custom, a place and an event you can bring into the story.
- Removed and disabled holidays are not sent to the model.

### Relationship graph and family
- **Ties** — who is who to whom. Tap a person to keep only their ties; the graph is small in the card and opens in a large window with zoom.
- **Family** — the family tree. Relatives come from past turns too, including ones offloaded to files: the tree reads the chat chronicle. Depth is set by "🌳 HUD messages for the family tree".
- If the model names an "uncle" without kinship, HUD asks whose brother he is and remembers the answer.

### Side panel and archive
- **🗂 HUD on the side** — the card in a side panel: in messages, on the side and in messages, or only on the side. Width and edge are configurable.
- **🗄 HUD archive** — a summary of the whole chat history: days, places, secrets, relationships, pregnancies, soundtrack. It reads the chronicle, so it works after offloading too.

## Customization

The **🎨 Customization** window changes looks only, not content.

- **Theme** — dozens of ready themes, your own themes, colors, background and banner, fonts, glass transparency.
- **Block views** — most blocks have several views: the classic one and three new ones. The view changes at once in the live preview on the right.
- **Click opens its setting** — turn it on and tap any block in the preview: the window scrolls to its setting.
- **Sample** — show an example with all blocks, even if the chat has none yet. Handy for seeing everything and trying the question marks.
- **Icon drawing** — emoji or drawings in the theme color: line, ink, pixel, rounded.
- **Era look** — in the Middle Ages and in fantasy, blocks change their look for the era. Here any block can go back to its modern look, and with hidden magic, the other way round, take on the look of magic.
- **Each chat has its own look** (settings → ✨ Look and language → 🎨 Look per chat) — era, theme, colors, fonts and block views are remembered per chat. One chat's look can be taken into another or made common.

## All settings

Below is every setting from the **📊 TavernOS** panel with its explanation, in the order they appear. The list is built from the panel itself, so it always matches your version.

<!-- guide:settings -->

## What the model writes

The model writes one block per reply:

```
[HUD]
{ "sc": { … }, "cs": [ { "N": "Name", … } ], "me": { … }, … }
[/HUD]
```

- **Keys are short codes**, values are plain text in the interface language (or in English, if set so). Labels inside values are codes too: `Bs: "eng: 80 rested; slp: 40"`.
- **An empty field** is written as `empty` or left out.
- **`nc` means "no change".** For slow fields (looks, character, companions and the like) the model can write `nc` instead of rewriting them every turn, and the HUD fills in the previous value from past turns. On screen you see the full text.
- **Shorter and cheaper.** In "💰 Saving tokens" there is **📏 HUD on one line** (JSON without line breaks, about a tenth fewer tokens) and **🗜️ Compact values**: checked fields get a firm size in words and points, set in "🎛️ Fine tuning" below them.
- **A disabled block or field** is not in the instruction, and the model does not write it. Single fields are turned off in "🔬 Fine tuning" (What the HUD shows).
- **The latest HUD snapshot** goes to the model with the instruction: it updates the world instead of building it anew.
- **The parser forgives mistakes**: a cut-off reply, missing commas, quotes inside strings, YAML instead of JSON, sections in the wrong place.

### Reply sections
- `sc` — scene: time `T`, date `Dt`, place `L`, weather `Wt`, atmosphere `At`, mood `Md`, plot twist `Tw`.
- `cs` — characters as a list; each has a name `N` and the fields below.
- `us` — your character (if the player block is on).
- `me` — memory: the day's events, mood, routes, facts, secrets, Chekhov's guns, invitations, the turn's chores.
- `phn` and `cm` — the character's phone and chats; `tp` — intercepts.
- `sm`, `lt`, `ov` — medieval: casket, letters, overheard talk.
- `dy` and `bd` — diary and body diary; `dr` — dreams.
- `wd` — world: news, rumors, forecast, ads, economy, events, city services, horoscope.
- `pet` — companions; `bb` — babies; `cb` — combat; `mw` — "meanwhile" in the world.


### Era, technology and magic
Three independent settings (Settings → 🚀 Quick start → "World") build almost any world:
- **Era** — modern (phone and intercepts) or medieval (casket and overheard talk).
- **Technology** — from the card and lorebook, primitive, pre-industrial, industrial, modern or future. It tells the model what the world lacks and sets the look of the weather scene (tents, factories, domes); the pair of blocks is chosen by the era.
- **Magic** — none, hidden from society (the world looks ordinary and blocks keep their look — though any block can be restyled "for magic" in Customization → Era look) or open to all (a fantasy era: block styling changes). And its kind: spells or innate powers.

The world's particulars — who wields magic, what it is called, what it cannot do — the model takes from the card and lorebook; the settings only set the frame. Magic does not by itself mean portals, scrolls and spells.

### Powers in worlds with magic
When the world has magic — hidden or open — people who wield it get powers. The parts are the same at both magic levels, the words differ: **high** magic means schools and spells (illusions, portals, wards, curses), **grounded** means innate elements and spirits, with no spells or portals. Each part has its own checkbox under the magic choice.
- **Mana** — the `mn` label in Body state, a fifth gauge next to energy. Power spends it; story time brings it back: about 10 per hour of rest, a night's sleep refills it. The Abilities block shows by what hour it will be full; the HUD reminds the model how much mana there was last turn.
- **Abilities** (`Ab`) — the school or gift, its level (novice → master), what it can do, what it CANNOT do, the cost. The model keeps power within these bounds: no dragon from a minor illusion, a new skill comes only through the story.
- **Backlash** — overstrain goes to Illnesses and injuries as "backlash — …" at one of four stages: dizziness (~1 h), nosebleed (~3 h), fainting (~12 h), severe injury (days to weeks). The card shows the ladder and how long it will last by story time.
- **Spells** (high magic) or **Effects** (grounded) — `Ef`: what acts on a person and until what hour. The HUD counts the time left and asks the model to remove what has expired.
- **Body and power** — the cycle, pregnancy, wounds, fatigue and stress change control over power (at ovulation it pushes out, late in pregnancy it is hard to call). Whom to tell — the model, you, both or no one — is set in the settings.

### Fields by section

The list is built from the "🔬 Fine tuning" catalog and the question-mark dictionary. The code on the left is what the model writes.

<!-- guide:fields -->

## Macros

- `{{hudLast}}` — the chat's latest HUD as compact JSON with short codes, without empty and disabled fields. Works with `{{if hudLast}}…{{/if}}` in the new macro engine.
- `{{hudByt}}` — the everyday-life summary in one line ("no food for 7 h; sleep debt 6 h"), if "Life → model" is set to the macro.

## Problems and fixes

### No card appeared
- **The model did not send a block.** Check that **🚀 Quick start → "How the HUD appears" → "With the reply"** is on. If it is off, HUD is created only with the **➕ Create HUD** button.
- **The backend does not accept a system message at the end.** Turn off **"🧩 HUD instruction as a separate message"** — the schema goes inside the normal prompt.
- **The block is in the text but there is no card.** Reload the page. If the block still shows as text, open the browser console (F12) and send the error to the contacts below.
- **The card came out empty.** HUD rebuilds it by itself; if it stays empty — press 🔄.

### HUD is incomplete or broken
- **"Incomplete HUD: the model skipped …"** — in **🤖 How the HUD is made → 🩺 Reply check → "Incomplete HUD"** choose "Complete it by regeneration": HUD completes what is missing with a regeneration. Or press 🔄 by hand.
- **"The reply was cut off by the token limit"** — raise **"🧠 HUD token limit"** (🤖 How the HUD is made → 🔄 HUD regeneration). HUD retries with a doubled limit by itself, but the last sections may be missing.
- **"The model spent the whole limit on reasoning"** — for thinking models raise the limit or turn reasoning off for HUD regeneration.
- **"The model returned an empty reply"** — often a provider filter. Try another connection profile for HUD regeneration.
- **The model mixes up fields or writes extra.** Turn off unneeded blocks and fields in "🔬 Fine tuning": a shorter instruction means fewer mistakes. Weak models are helped by **"📸 Snapshot of the last HUD at the end of the instruction"**.
- **The model contradicts everyday life** (ate an hour ago, yet writes "hungry") — turn on the contradiction check in 🤖 How the HUD is made → 🩺 Reply check.

### HUD regeneration does not work
- **"The provider did not reply within N min"** — reasoning models think for a long time: raise "Wait for a reply" or lower "HUD token limit".
- **Regeneration writes off-target or empty.** Pick a separate connection profile for it (it can be cheaper than the main one) and check how many history messages it gets.
- **Local model (KoboldCpp, text completion).** For profiles with a local model HUD uses the profile's instruct template; if the reply is odd — check the template in the profile itself.

### Slow, or the chat takes long to open
- Turn on **"Build a tab only when it is opened"**, **"Lighten old collapsed cards"** and **"Long chat mode"** (⚡ Performance).
- Lower **"🪶 Build the latest cards right away"** and set a **"🧹 Card limit"**.
- If the chat itself takes long to save and open — **🗜 Unload the chat**: full HUDs of old turns go to Tavern files, with summaries left in their place. **↩ Restore all** puts them back.
- After offloading, the archive, the tree and everyday life still see old turns through the chat chronicle.

### Settings and devices
- **Different settings on PC and phone.** HUD settings are kept both in the browser and in the Tavern; on load the newer copy wins. Change any setting on the device whose look you like and reload the page on the other one.
- **A background or banner did not move to another device.** Pictures loaded from a file stay on their device — load them there by hand.
- **The chat is open on two devices.** The last save wins. After deleting or restoring HUD on one device, reload the page on the other.

### Data in the card
- **A character died or left, but Life still counts them.** Press the bin next to their name in weight, sleep or wardrobe. Bring them back at the bottom of Life, in "Not counted".
- **A relative disappeared from the tree.** The tree takes kinship from the chronicle; check "🌳 HUD messages for the family tree". If the model wrote kinship only through a third person ("Jonathan's son"), the person appears once their name shows up in the turns.
- **A wrong entry in memory, relationships or the phone.** Turn on 🗑 and remove the plate, or fix it with ✎.
- **The model marked the end of a pregnancy by mistake.** Press "Undo" on the plate.

### Scene music
- **"The model sent an empty selection" or "cut off on reasoning"** — raise the reply limit in the music settings (2048 tokens or more).
- **"Search did not find such a track"** — the model may have made the track up; turn on track checking by search.
- **MoodTube did not find the track** — a preview plays; this is not an error.

### Language and translation
- **Some text stayed in Russian in the English interface.** Names and the text the model writes are not translated — they are data. If a HUD label itself is not translated, send a screenshot to the contacts.
- **Your own language.** Fill in the `translations/template.csv` table and load it with **📄 Load a translation (.csv)** — the new language appears in the menu.

### Removing HUD or the extension
- **Remove only the extension:** first, in the open chat, press **🧳 Remove service files** at the end of the settings — HUD returns into the messages, offload files and the chronicle are removed from disk.
- **Remove HUD from a chat for good:** **⚠️ !!DANGER!! Remove HUD from chat** at the very end of the settings. It cannot be undone — make a copy of the chat first (chat menu → "Manage chat files" → export).
- **Only hide the blocks:** a Regex rule in the extension with "Alter Chat Display" and "Alter Outgoing Prompt": `/\[HUD\](?:(?!\[HUD\])[\s\S])*?\[\/HUD\]/gi`, empty replacement.

## Safety and data

- HUD has no servers or analytics of its own. Requests go only through your connection in SillyTavern.
- Everything is stored on the Tavern server: chats, HUD, the chronicle, offload files, settings. The browser keeps only reactions and the parse cache.
- **💾 Settings file** saves all HUD settings in one file. API keys and passwords are not included.

## Contact

Questions, bugs, ideas — write. With a bug report, include the HUD version (it is in the settings header), what you did and, if there is one, the error from the browser console (F12).

- **Telegram:** [t.me/alewwiHUD](https://t.me/alewwiHUD)
- **Discord:** `alewwi`
