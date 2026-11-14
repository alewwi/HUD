# Changelog

[Русская версия](CHANGELOG.md)

All notable changes to TavernOS HUD, newest first, starting from version 23.88.7.

## 23.89.25 — 2026-11-14

Season screenshots in the README and an updated card shot.

### Added
- **Seasons and holidays in the README** (the "🎬 Scene" section): four modern seasons, four medieval ones, New Year by day and at night with fireworks, Halloween and Easter.
- `tests/tools/season-shots.mjs` re-shoots them from the seasons stand without SillyTavern. With "holidays" ticked, the stand puts spring in Easter week.

### Changed
- The full card screenshot in the README is re-shot in Russian and English.

## 23.89.24 — 2026-11-14

### Fixed
- **The "Favourite treat" icon** is a wrapped sweet; the old one looked like a "no entry" sign.
- **Tile labels on the companion card** wrap by words with the icon kept at the start: "Favourite treat" in a narrow tile no longer breaks away from its icon.
- **The English sample HUD** shows the companions' age, "Wants" and "Favourite treat", like the Russian one.

### Changed
- **The Companions tab screenshots in the README** are retaken with the new cards.

## 23.89.23 — 2026-11-14

### Added
- **A richer companion card.** Under the name: age, health in one word (healthy, tired, wounded, sick, a malfunction for machines) and when it last ate. Five-step need bars, "Wants" and "Favourite treat" tiles (the model writes them when they are known), and a trail at the bottom: paws, hooves, bird tracks, a wave for a snake, sparks for a spirit. Age, wants and treat show in the tamagotchi and the classic view too.
- **New animals with their own portraits:** a fox (an arctic fox, a fennec), a bear, a horse and a pony (a unicorn gets a horn, a pegasus wings), a rabbit, rodents (a hamster, a rat, a mouse, a squirrel, a ferret), an owl, a bat, a snake. Dog breeds such as a Dalmatian, a husky or a shepherd are recognised as dogs.
- **The coat follows any colour in the name.** A black cat is drawn black, an arctic fox white, a bay pony bay; two-tone coats ("black and white") too. Patterns on top of the fur: stripes for tabbies and tigers, spots for spotted animals and Dalmatians, patches for calicos and piebalds.
- **Eye colour**, wherever it comes up: "sapphire eyes", "green-eyed", "with brown eyes", two colours for heterochromia.
- **The HUD remembers each companion's coat and eyes** in the chat data. Once the cat's eyes were called blue, they stay blue even when the model doesn't mention them. A new mention replaces the old one, and re-rendering an old message doesn't overwrite a newer one.
- **The "how it changed" slider on the body map** steps through that turn's clothes and body marks, not only sensitivity: you can see when the coat came off and when the hickey appeared. A turn where the model named no clothes keeps the clothes of the turn next to it.

### Fixed
- **A "single" or "free" status ends a marriage.** A marriage from old turns stayed on the graph and in the family tree even when the character's status said "single"; now it becomes an ex. And "married to …" in the status adds a marriage when the model didn't write it in the relations.
- **Namesakes with different first names no longer merge into one person** ("Ida Larsen" and "Nina Larsen"). "Katerina" and "Ekaterina", the Russian and English spellings of one name still match.
- **"Without a glove" means no gloves.** "Left hand without a glove", "without white gloves", "no gloves" drew gloves on the body; now an item is off when "without" comes right before its name. "A sleeveless dress" stays a dress.

## 23.89.22 — 2026-11-14

### Fixed
- **The family tree no longer makes family friends into uncles.** Children call any grown-up "uncle" ("strict uncle", "kind uncle with cookies"), and that word went straight into the label under the card: "uncle · child" stood under every man, even after the answer "Not family". Now "uncle", "aunt" and "nephew" reach a label only once the kinship is confirmed: the uncle is a parent's sibling, or the player said whose sibling he is. "Not family" removes the word everywhere, including from a twin brother.

## 23.89.21 — 2026-11-13

### Changed
- **The autumn gust of maple leaves** crosses the scene only in windy weather, including wind with rain or a storm. On calm days it is gone, and its seven leaf animations stop.

## 23.89.20 — 2026-11-13

The moving weather scene puts no more load on the browser than before the new drawings.

### Changed
- **Stars no longer twinkle for nothing in daylight.** While they can't be seen, the star layer is switched off entirely.
- **Fireflies** run only on quiet summer evenings and nights, when they are visible; otherwise their layer is off.
- **New Year tree lights** of one colour blink together: four animations instead of twenty-two.
- **The spring puddle reflection** builds only trunks and crowns, without the hidden birdhouse and birds.

## 23.89.19 — 2026-11-13

Two weather scene fixes after a live check of every season, weather and time of day.

### Fixed
- **No rainbow in the dark.** After rain or a storm in the previous turn it hung in the sky in the evening and at night; now it shows only in daylight.
- **The snowman no longer sinks in the snow on a tall card.** Snowdrift height was a share of the scene height, so on a tall card the drifts doubled and buried him up to the hat. Now they are no taller than on a regular card.

## 23.89.18 — 2026-11-13

Weather scenes polished: bare trees, spruces and birds redrawn, the medieval era gets its own winter, spring gets a far view.

### Added
- **Spring far view:** patchwork fields on the hills (plowed land, rapeseed, winter wheat, boundaries, a hedge, a road), a farmstead with a half-timbered house, a barn and blooming apple trees, a windmill with turning sails.
- **Medieval winter:** log huts with log ends, a steep plank roof under snow, a ridge horse and a window in a carved frame; a castle on a far hill that hides behind the trees and spruces on a narrow card; a snowman wearing a clay pot, with a sash and a birch besom; a wooden sledge.
- **A birdhouse** with a chick in the hole: when the starling brings a worm, the chick stretches up and opens its beak (in March the starling carries twigs).

### Changed
- **Bare winter trees** grow by branching: the trunk tapers, forks have bark swellings, snow lies on top of the thick branches, the branches are shorter. Spruces and the New Year tree are drawn in tiers with drooping boughs and snow caps.
- **The woodpecker** sits on a twig by the trunk, **the bullfinch** on the lamp's cap, **the sled rope** lies on the snow.
- **Autumn:** campfire smoke rises in puffs and fades, the lantern stands on the fence post, the hedgehog is drawn as one piece, the dark spot in the tree crown is gone.
- **Halloween pumpkins** have carved cuts with rind thickness and different faces; they glow from inside in the evening.
- **The gull** is redrawn with wings growing from the shoulders. **The sailboat** no longer rises above the horizon in the evening.
- **Medieval summer:** the boat lies over the sand castle and the nets, the bucket and spade are wooden.
- **Narrow cards:** the spring bush and tulips no longer cover the right tree, grass and a dandelion stand between the trunks; the first winter house's wall base is under the snow; the summer umbrella sits in the right corner with the towel under it.

## 23.89.17 — 2026-11-13

Weather scenes got richer: new details in all four seasons, the old ones redrawn, and the hedgehogs walk like hedgehogs.

### Added
- **Summer:** a palm with a curved ringed trunk, feathery fronds and coconuts, a lighthouse on the cape (its beam turns at night), a kite, a crab, shells and a starfish, clouds.
- **Autumn:** a scarecrow with a crow, pumpkins, a lantern on the fence, mist over the meadow, a gust of maple leaves.
- **Winter:** snowy spruces, a sled with a trail of footprints, a street lamp with a bullfinch (at night, a cone of light and a pool on the snow).
- **Spring:** a duck leads her ducklings across the grass in the middle of the meadow (the mother pecks at the grass, the ducklings waddle), tulips, clouds.
- **Night lights on their own layer:** the lighthouse beam and the lantern and campfire glows no longer dim with the darkened scene.

### Changed
- **Hedgehogs.** The first hedgehog goes from the apple tree to the burrow in short runs, sniffs at every stop, and its legs move only while it walks. At the burrow it greets the second one nose to nose, both go inside, then the first one walks back. The second one sits at the entrance facing the first and waits for it.
- **The burrow** is a mound of earth with fallen leaves, a root over the entrance, dry grass and pebbles; the entrance darkens with depth.
- **Snowman, sandcastle, campfire and flowerbed flowers** are redrawn.
- **Spring flowers and tulips** stand between the trunks and never overlap the trees at any width; on a narrow card the extra ones hide.
- **The far winter house** is opaque, same size.

## 23.89.16 — 2026-11-13

Translations into other languages are complete: the HUD is written in the translation language, and the Customization sample is translated along with the interface.

### Added
- **✍️ HUD in the translation language** (under 🌐 Language, on). With a language from the table (Chinese, Spanish and others) the model writes HUD values in that language, like the story, instead of English. Keys and short codes stay English: the HUD reads the block by them. Off: values in English, as before.
- **The Customization sample in the translation table.** The made-up story of the sample is translated too: its rows are at the end of `translations/template.csv`, marked "Customization sample". With a language from the table the window shows the sample in that language. People's names and codes are not translated: the HUD links people across tabs by them.
- **A third new view for eight blocks** (shipped in 23.89.12 without a note): trust scars — "Patches" (a heart with sewn-on patches), invitations — "Paper plane", "Does not know" — "Puzzle", weight and height — "Tape measure", end of pregnancy — "Moon", promises — "Chain", "Meanwhile" — "City at night", "Who knows what" — "Bubbles". Invitations show the face of whoever invites.
- **Richer thoughts and subtext.** "Echo" — a nautilus shell and waves, "Fogged glass" — a framed window with city lights, "Ultraviolet" — evidence with a tag, a ruler and a torch, "Behind the mask" — a baroque Venetian mask with lace, pearls and feathers.

### Changed
- **Dark themes get dark paper.** Clearance badges, the dossier, the invitation card, notes, tags, the herbarium, the novel page, the ink letter and the scale dial are dark on dark themes and stay as they were on light ones.
- Lists in values also split on the Chinese commas "，" and "、": Chinese values no longer merge into one pill.

### Fixed
- **Pregnancy exams and swipes.** An opened exam showed in every swipe of the reply. Now it is open only in the swipe where it was opened: in another swipe the exam is closed again and the model doesn't know the findings; going back opens it.
- Holidays in the phone calendar ("New Year", "Easter", "Christmas") stayed in Russian in the English interface.
- The "remove scar" crosses sit exactly in the centre.
- View animations at rest no longer freeze mid-turn: badges, tags, bubbles and feathers stand straight.

## 23.89.15 — 2026-11-13

The family tree question about an "uncle" goes away right after you answer.

### Fixed
- **The "Whose brother is he?" plate** stayed after a choice: the card was not rebuilt because the tree is drawn lazily and its markup did not change. Now the plate goes away at once and the tree redraws with the answer.

## 23.89.14 — 2026-11-13

New views for seven blocks; Customization follows the card order, every click on the sample leads to its own setting, and changing a view no longer loses the scroll or makes the HUD blink.

### Added
- **Views for seven blocks** (Customization → Block views). Pregnancy — "Mobile", "Knitting", "Sprout", "Week". Relations — "Lockets", "Address book", "Ivy", "Contents". Combat — "Fighting game", "Tactical tablet", "Chess game", "Summary". Relationship graph — "Coats of arms", "Seating", "Tapestry", "Matrix". Family tree — "Crown", "Book of lineage". Timeline — "Ship's log", "Music staff", "Storyboard", "Day ruler". Emotions — "Stained glass", "Palette", "Swatches", "Gradient".

### Changed
- **Customization follows the card.** Character blocks come in the order of the rows in the tab: plaques on top, look, body, location, thoughts, things and plans, ties, drama, intimacy. Tab blocks come in the order the player has the tabs (pinned first); move a tab and its section moves too. Memory goes top to bottom, as on the card. "Header and name" comes before "Portrait", the "Details" sections follow the card, "Body handwriting" sits with the body diary.
- **Desire under the cycle, the "who knows what" grid and "A secret surfaced in an argument" are in the main settings** (HUD blocks → Body and health, Memory and plot): they set what the HUD shows and how it behaves, not the look. "Reset", "Default" and "As it was" in Customization no longer touch them.
- Kinship words on family tree tags and in "mother → daughter" labels are translated in the English interface.

### Fixed
- Clicks on the sample went to the wrong place: Relations and the headers of Emotions, Invitations and Promises led to the general background, Pregnancy to the babies in the womb, Timeline to the route, body diary entries to the regular diary.
- Changing a view in Customization reset the relationship graph to a placeholder: the tree went back to "Ties" and the scroll jumped. Now the graph and tree are built at once, the "Family" view, zoom and scroll stay, and the scroll keeps to the same block.
- Changing a view made the preview blink: the open tab faded in again and decorations restarted from the first frame. Now only the block itself changes.

## 23.89.13 — 2026-11-13

The family tree no longer turns a family friend the children call uncle into the mother's brother, and asks whose brother he is.

### Added
- **The tree asks about an "uncle".** When the model calls someone an uncle, aunt or nephew and the HUD has no kinship with the child's parents, a question appears above the tree: whose sibling is this — one of the child's parents — or "Not family". The answer is kept in the chat: family stays in the tree even after the model stops writing it, and "not family" is never asked again and stays out of the tree. Twins are a pair: an answer about one covers the other. One button is highlighted as the likely answer. Records of children from the Nursery count too.

### Changed
- The main character's branch is labelled with the main character's surname first, even when the children carry the mother's surname.

### Fixed
- A family friend the children call uncle became the brother of the child's first parent in the tree and dragged that parent into someone else's branch. Now a parent who knows the "uncle" as someone else (a business partner, a friend's husband) is not taken as his sibling, and without kinship in the HUD the "uncle" is added only after an answer.
- English kinship labels with adjectives — "strict uncle", "icy little niece", "protective older brother" — now count as kinship, like Russian ones. "Called uncle", "like an uncle", "best friend's uncle", "hates her father" do not.

## 23.89.12 — 2026-11-13

New views for the diary, body diary, intercepts, thoughts and subtext; the Nursery asks who got the age wrong and decides on its own who is a child; children show up in the family tree.

### Added
- **Diary views** (Customize → Block views). Diary — "Spread" (a book page with a ribbon bookmark and a drop cap), "Private blog", "Typewriter". Body diary — "Silk", "Kiss", "Thermogram". Intercepts — "Terminal", "Transcript", "Reels", each with its own chat tabs. All 40 diary moods differ in every view by colour, icon and mark; pages stay dark on dark themes.
- **Thoughts and subtext views.** Thoughts — "Echo", "Lantern", "Misted glass". Hidden subtext — "Invisible ink", "Ultraviolet", "Behind the mask".
- **One more view** for eight blocks: weight — "Tape measure", end of pregnancy — "Moon", "Doesn't know" — "Puzzle", trust scars — "Patches", "Who knows what" — "Bubbles", promises — "Chain", invitations — "Paper plane", "Meanwhile" — "City at night".
- **"The age doesn't match".** When a child's age by HUD and in the model's reply differ more than the model's words allow ("2 years" means two to three), the card asks "Who is wrong?". "The model" — HUD keeps its age and gives the model the right one from the next turn. "HUD" — HUD moves the birth date to match the model. On a new jump HUD asks again.

### Changed
- **The Nursery is the child's card.** A child younger than the age in settings is shown in the Nursery even if the model wrote them as a regular character; an older one gets a regular character card instead of a "grown up" line.
- Memory height goes up to 1500 px; the tab height setting now applies to intercepts too.

### Fixed
- Children born during a time skip showed as newborns: the birth was dated to the first scene after the skip. Now the age comes from the model's reply and the birth date is moved (it also reads "born in February 2028").
- The family tree missed children when the kinship came with a description: "her restless two-year-old son", "beloved mom", "a son he doesn't know". "Sworn sister", "godmother", "a second mom" are not counted as kin. Relations of children from the Nursery go into the tree too.

## 23.89.11 — 2026-11-12

The phone can be regenerated apart from the rest of the HUD, phone rumors get a date and time, and scars, theme pictures and section styles now work where they stayed silent.

### Added
- **Regenerate only the phone.** A faint ↻ icon in the phone's status bar. The model gets only the part of the instructions about chats and apps. If it sends the whole HUD or a full message, only the chats and apps are taken, the rest of the HUD stays as it was. Tap again to cancel; the previous phone goes to «↶» on the card, several versions are kept.
- **Date and time on phone rumors and comments.** The date and hour come from the turn where the entry first appeared, the minutes and seconds are its own and never later than that turn. The time is remembered: old entries keep it, new ones get the new turn's time. Feeds go from newest to oldest.
- **Every theme picture one by one.** When one theme layer holds several drawings (the Vampire theme's fangs, medallion and candelabrum), each gets its own button and can be hidden alone. Clicking such a drawing in Customization opens a menu: the drawing itself or the block above it.

### Fixed
- Trust scars of a swiped-away variant stayed when the new swipe came without a HUD (a refusal, a cut reply), and later cards and the model saw them. Only scars the current variant confirms remain now.
- "Image in the header corner" and "Eclipse ring" didn't work in a banner header.
- Section styles (Moon glass, Label and others) and Ink wash didn't reach the Key block and its views.
- Label on dark themes: cards stayed dark while the text turned black and unreadable.
- Phone: the anonymous icon in Rumors sat below center; in Contacts the circle stood above the name instead of beside it; on the lock screen the notification avatar was faded, off-center and slid under the text with the Pill style.
- Two generations for one message no longer start at once.

## 23.89.10 — 2026-11-11

Eight blocks get a choice of view, "Meanwhile" moves to the World tab, phone rumors look like a live feed, and long Memory lists fold like the character ones.

### Added
- **Views for eight blocks** (Customization → Block views): two new views next to each old one. Weight and height: "Bathroom scale", "Silhouette". End of pregnancy: "Herbarium", "Path". "Doesn't know": "Redacted", "Blind spot". Trust scars: "Kintsugi", "Stitches". "Who knows what": "Doors", "Clearance". Promises: "Knots", "Who to whom". Invitations: "Invitation card", "Wax seal". "Meanwhile": "Cameras", "Novel chapter".
- **"Meanwhile" is in the World tab**, right under the headlines. When a turn has no World tab, it stays in Memory.

### Changed
- **Phone rumors.** "People say" and "Online chatter" tabs with counts. Rumors are whisper bubbles: the fresh one stands out, older ones fade. Comments are a post feed with an anonymous avatar and a post number; tap "Anonymous" to see the nickname.
- **Memory:** Timeline, Promises and the people in "Who knows what" fold after three items, like character lists: three and a "More N of M" button on phones, three and a scroll on PC.

### Fixed
- "[g1] fired" and "[p1] kept" mark the gun or promise itself instead of replacing it with the word; leftover "fired" and "-" items are gone.
- Memory sent as updates no longer brings back removed items or gets cut when carried over.
- An unanswered invitation or promises show the Memory tab even when the turn has no other memory; the invitation badge finds the card in any view.
- Initials in "Who knows what" no longer come from prefixes like "THE".
- A reply translated before 23.89.8 no longer keeps the translated HUD label ("[平视显示器]") above the card.

## 23.89.9 — 2026-11-11

One model can write the story and another the HUD: the HUD is written by a separate request through the chosen profile. The archive collapses and filters long lists, and pregnancies no longer go missing in it.

### Added
- **➕ HUD as a separate request after the reply** (Generation → HUD regeneration). After every character reply the HUD is created by a separate request — through the "HUD regen profile" if one is chosen. One model (a local one, for example) can write the story and another the HUD. It works instead of "HUD in every reply": turning one on turns the other off. Before, the chosen profile only worked for the 🔄 and ➕ buttons, and with "HUD in every reply" the main model always wrote the HUD.
- **Archive: status filters.** Secrets: unrevealed and revealed. Guns: hanging, building, fired. Relationships: changed and trust. Timeline: dates, places and pregnancies. Pregnancies: ongoing, birth, lost. Each filter shows its count.

### Changed
- **Archive: newest on top, long lists collapsed.** Every tab except statistics and the dashboard shows the latest 10 records first, then "More", "Show all" and "Collapse". The timeline puts the latest day on top and the latest event of a day first. A person's card in Relationships shows the six latest rows, the rest under "More".
- A connection profile for a text model (Text Completion, local KoboldCpp, llama.cpp and others) gets the HUD, music and assistant questions in the profile's instruct template. Before, the messages were glued into plain text with no roles.
- The archive timeline marks the start of every pregnancy, not only births and losses.

### Fixed
- The archive no longer loses a pregnancy when, after a miscarriage, the model kept writing the old term in the HUD without marking the loss: the next pregnancy was merged with the previous one, and the miscarriage covered both. Now a birth or loss marked in the chat is a boundary, and so is a term that dropped after three weeks of story time.
- A pregnancy confirmed by a test gets into the archive even if the model hasn't put it in the HUD yet. An unconfirmed conception isn't shown, so the roll isn't given away.

## 23.89.8 — 2026-11-11

The HUD no longer breaks when the chat is translated by SillyTavern's built-in translator, and the card of a translated reply is shown in the translation language.

### Added
- **🛡 Protect HUD during chat translation** (main settings, on by default). For SillyTavern chat translation (the Chat Translation extension: Google, Yandex, Bing, DeepL and others). The HUD block is no longer sent for translation: only the prose goes out, so replies translate faster. The card of a translated reply is shown in the translation language by the same service; translated lines are remembered, so a reload makes no new requests. The message and the model's prompt keep the original. Card lines are sent to the chosen translation service too; if it is down, the card stays in the original.

### Fixed
- Chat translation mangled the HUD block: "[HUD]" got translated, keys and quotes changed, and translated junk hung above the card. Messages that were already mangled repair themselves when shown.
- Translated prose stuck to the HUD block ("wind.[HUD]"): line breaks where the text was split are kept now.
- The ExtBlocks extension keeps its blocks in the same message field as the translation and wiped the translation on edits, on every new reply and when a chat opened. Now the translation stays, and ExtBlocks blocks are added after it.

## 23.89.7 — 2026-11-11

The HUD interface can be translated into any language, through English, with a spreadsheet.

### Added
- **Translations into other languages.** Every interface string is in the `translations/template.csv` table: the English text and an empty column for the translation, with the Russian original only for reference. A translator needs neither Russian nor code. A string without a translation stays in English, so even a partial translation works. A built language appears in the 🌐 Language menu by itself. The guide for translators is `translations/README.md`.
- **Check your own translation right in the HUD.** In the settings under 🌐 Language there is "📄 Load a translation (.csv)": the HUD switches to the file's language at once and says how many strings were taken. Rows with errors (a lost `{1}`, a different tag) go to the console with the reason. The file is kept only in this browser and doesn't touch the extension files, so updates from SillyTavern keep working. "✕ Remove" brings back English.

### Changed
- With a language from a table, the model gets its instruction and hints in English and writes the HUD in English, because parsing understands Russian and English. CSS labels, English strings the code assembles itself and zodiac signs are translated by the table too.

### Fixed
- Switching the language without a reload no longer leaves pieces of the previous language: the zodiac sign on the card, settings hints and parts of cards that were off screen at that moment are translated again.

## 23.89.6 — 2026-11-11

### Fixed
- In the English interface the "Max height of tabs (0 = default)" setting stayed in Russian. The translation existed, but for labels like "(…):" the translator cut the closing bracket together with the colon and could not find the string. Such labels are translated now.

## 23.89.5 — 2026-11-10

Theme "Reset" brings back the whole look, and the Customization sample became one coherent made-up story.

### Changed
- **Theme "Reset" — the whole look back to the defaults.** It used to bring back only the colors and fonts that themes set, while the header corner picture, the portrait decoration, drawings by place, paper and seal, block views and pictures hidden one by one stayed. Now all Customization styling is reset. Window behavior is left alone: Detailed mode, "Click opens its setting", animations, the budget. "↶ Step back" brings everything back.
- **The Customization sample is one coherent story.** Times, people and events agree across blocks: who called whom and when, promises and deadlines, diaries no later than the scene, dreams only for those asleep, height and age as on the cards. A new twist — the brother's spare key.
- **The player in the sample has no ties to anyone in it.** They spend their own evening at home, and no sex is set in their looks. Lilian's partner is a new character, Artyom, with his own card.
- Blocks the sample lacked are in: a chase in combat, someone misled in the secrets grid ("wrong"), "broken" and "changed clothes" in daily life, a hidden pregnancy with its reminder.
- The examples in the model instructions and in the tests use made-up people. Unused lines were removed from the English dictionary.
- The README screenshots were retaken on the new sample.

## 23.89.4 — 2026-11-10

Tab height is set by one setting, and in Customization a click on the sample leads to the right setting.

### Added
- **Maximum tab height.** A new setting "📏 Max height of tabs (0 = default)" sits right under the Memory height. A number from 200 to 1500 px sets one height for every tab: character, "you", diary, world, dreams, companions, daily life. Anything taller scrolls inside the tab. 0 keeps each tab as it was (220–460 px). Less than 200 is raised to 200. Intercepts never go below 340 px, otherwise there is hardly room for the chat. The phone keeps its own height, and Memory has its own setting.
- **A click leads to the setting.** In Customization, clicking any part of the sample opens the setting behind it: the section opens, the panel scrolls, the field lights up. The 🎯 "Click opens its setting" button in the window header turns this on and off.
- When a card's settings sit in different sections, a short menu by section opens at the click. A section with more than three settings is one line with a counter and opens them all at once.
- **Theme pictures one by one.** Theme drawings get a list of the pictures now on the card. A click hides or brings back one picture and leaves the rest. Each theme has its own list.

### Changed
- The Memory height limit is raised from 600 to 1500 px.

## 23.89.3 — 2026-11-10

The phone gets its own looks, settings and new apps, and HUD no longer flashes raw code.

### Added
- **Phone types:** iPhone, Android and Keypad. The keypad phone has a monochrome screen, a numbered menu and a working keypad: a digit opens an item, OK unlocks. Separately, a cracked or shattered screen.
- **A Settings app in the phone.** Everything about the phone in one place: type, clock, notifications, theme, message colors, icons, which apps to show. The values are shared with the main settings and Customization.
- **A Rumors app.** The last 10 rumors and 10 city comments, taken from what the model already writes. A comment's author is hidden until tapped.
- **Appearance.** Notification styles (stack, pill, timer ring, bubble), five lock screen clocks, and a background for a single chat: a ready-made one or your own photo.
- **The next plan** on the home and lock screens, and a birthday today or tomorrow.
- **"Last seen 23:10"** in a private chat's header, and a name color for each group member.
- **The phone in someone else's hands.** The `[BY: who]` tag shows "Not the owner: who". What the person did off-screen stays hidden until tapped; a blocked contact replaces the input field.
- **A contact under a false name.** A mask badge is visible at once, the real name only on tap.
- **What became of calendar entries:** done, cancelled, moved. A move does not create a second entry and leaves a trace on the old day.
- **Who paid.** When someone else pays the bill, the phone owner's money is not spent.
- **Rumors and Settings icons** in every theme set, with each theme's own objects.

### Changed
- **No raw code and no reloads.** Settings and looks apply at once. Changing the language and loading settings from a file no longer reload the page. While a chat opens, a "Building HUD…" plate replaces the raw block.
- **Medieval:** icon tiles are warm parchment instead of blue.

### Fixed
- **Invisible spaces between JSON parts** (U+2800, U+2007, U+3000) no longer break HUD parsing.
- **Phone body corners and the notification backing.** Blur leaked past the rounding, and a rectangle sat under the round pill.
- **Previews and notifications** no longer show raw forward and reply tags.
- **The open tab** is kept when cards are rebuilt.
- **Schedule:** leftovers like a weekday with commas no longer get into a plan's title.

## 23.89.2 — 2026-11-10

A review of what HUD decides on its own, without the model writing it.

### Fixed
- **The combat block no longer stays in the prompt without combat.** HUD read not only the story but also the HUD block of the last reply and the model's reasoning: one "explosion" in memory or "does not attack" in a plan kept the combat block on for dozens of peaceful turns. Now only the story counts, without viewers' nicknames.
- **More accurate combat words.** "Dragon", "epaulettes", "panic attack", "burst of laughter", "not within a cannon shot", "not even at gunpoint" and "the smell hit her nose" no longer count as danger.
- **A fresh wound turns combat on only right after it happens.** The model keeps an injury at the "fresh" stage long after the fight is over. Now the wound must be at 10% recovery or less, and "fresh" and the wound itself must be in the same entry.
- **Intimacy no longer starts from stray words.** "The jokes ran out", swearing, "has cancer", "the bullet penetrated the wall" are not a scene.
- **The body diary no longer extends intimacy by itself.** It is written only during intimacy, and its "desire" mood asked for that part of the prompt again the next morning. Now only the text of the entry counts.
- **Mood for music.** Words are matched from the start of the word ("burnt" is not grief, "restless" is not calm), whichever comes first in the text decides, and "a collapsed romantic illusion" or "without fear" no longer count as what they name.
- **Dreams in Daily life.** A dream was attached to everyone who slept that night, even to someone who did not sleep at all. Now it belongs to the person named in it; if that is unclear, it goes to the common list of dreams.
- **"Broken" means only what gets repaired.** A cup dropped in the street, a smashed vial and torn underwear stay events of the day, but no longer hang as broken things at home or go to the model.

## 23.89.1 — 2026-11-09

### Fixed
- **Music and assistant settings work again.** Since 23.88.100 the settings panel stopped while wiring them up: their checkboxes and fields could be clicked but changed nothing. Choosing another connection profile did not stick, the 🔄 button brought back the original one, and requests went to it. Profile lists now really update on their own.
- **X-ray under the cursor.** On mouse hover the penis stayed in place and only the hips moved. Now everything moves in one rhythm, same as on tap.
- **Body map on wide screens.** The list of zones was squeezed into a sideways strip, with labels stretched into narrow columns. It is now full-width rows: three in view, the rest scrolls down.

### Changed
- **The samples caught up with the new blocks.** The Customization sample now shows promises with every status and Meanwhile in both languages, and jealousy is written with names, as the instruction asks.

## 23.89.0 — 2026-11-09

Ideas from the Chinese SillyTavern community: "knowledge isolation", the "yesterday curse", affection locks, promises and parallel scenes. Only ideas were taken, no code.

### Added
- **Not everything was yesterday.** In the snapshot for the model, facts, promises, guns and secrets carry a number and an age — "[f3 · 5 days ago]", and shared memories carry an age. The HUD finds when an entry first appeared and counts by scene dates. The model no longer calls something from a week ago "yesterday". The marks never reach the message.
- **Memory as updates — by number.** The model can change an entry by its number — "[f3] new text", remove it — "- [f3]", a secret keeps its "id". Before, entries were matched by their first words, and one rewritten in other words got duplicated.
- **Who does not know what.** The character card gets a "Does not know" line from the secrets where they are among those not told. When someone who knows a secret and someone who does not are both in the scene, the model gets a reminder not to let it slip, once every eight replies.
- **Trust locks.** Trust grows in stages with lines at 20, 40, 60 and 80. A line can be crossed only on a turn with a key event: help with nothing to gain, danger faced together, a shared secret, support in a weak moment, a sacrifice. Talk alone keeps trust just below the line. When trust is right at the line, the model gets a reminder once every eight replies.
- **Promises.** A new list in Memory: who promised whom what, by when, kept or broken. A promise past its date is marked "overdue", and the model gets a reminder to settle whether it was kept. A kept or broken one shows for one turn, then goes.
- **Meanwhile.** 1–2 important people off screen: where they are, what they are doing and thinking, what they know about the main events, what they do not, and what they guess. A collapsed block in Memory. The model continues their last entry, with no extra requests.
- **Zodiac sign by date of birth.** In Age, the sign next to the date of birth is counted from the date itself, not taken from the model.
- New switches in the main settings: "Who does not know what", "Trust locks", "Promises", "Meanwhile". All on.
- Icons of promises and Meanwhile follow the Icons setting: emoji, pictures in the collapsed header, or pictures everywhere.

### Checked and fixed before release
- Ages come from a ledger kept in the chat itself, like the music cache: for each memory entry, the date it first appeared. Each new turn adds to the ledger from the latest messages, and old HUDs are no longer parsed. A full pass over history (up to 150 messages) happens once, for an old chat without a ledger. Opening a long chat does not slow down, and the budget estimate leaves the marks out.
- When the card background is light but the theme colors text light (a dark theme with a light background), text in promises, Meanwhile and "Does not know" takes the text color from the settings and stays readable.
- An entry the model rewrote in its own words is recognized by shared word roots instead of counting as new ("today").
- "- [f3]" on a first turn or without memory updates no longer stays as an empty list item.
- Promise status understands "fulfilled", "failed" and the Russian "выполнено", "не сдержано", "сорвано".
- Whoever is in the scene right now is left out of Meanwhile, even if the model wrote them there.
- The zodiac sign also understands dates like 1989-09-22.
- **Jealousy in chat shows the names, as in the sample.** The "who, over whom" names used to appear only when the model wrote exactly "jealous of X over Y" in one fixed form, and the instruction never asked for it. Now the model writes "the one they fear losing → the rival: how it shows", and the HUD also understands other forms: "of Y over X", "over X because of Y", Russian forms, and a rival alone ("jealous of Y"). A long phrase is not taken for names.

### Changed
- **Phone: long lists open smoothly.** The button under a list opens and closes it smoothly instead of with a jump, and its arrow turns along. When the system asks for less motion it happens at once, as before.
- The button says honestly how many are hidden and how many there are: "4 more of 7", and when open, "Collapse 4". The number used to be "all minus three" and was wrong when cards sit two to a row.

## 23.88.103 — 2026-11-09

### Changed
- **Underwear sits right under clothing, not at the very bottom of the card.** The Underwear row was missing from the field order and slid to the end.
- **Underwear is drawn as what is worn.** The picture used to be always the same — a bra and panties, men in boxers included. Now the silhouette comes from the words: bra, bralette, panties, thong, boxers, briefs, bodysuit, corset, chemise. With no garment named, a woman gets a set and a man gets briefs. A man gets a bra only if one is named.
- The silhouettes have more volume: a sheen on top, shade below, a waistband, lace stitching, a bow. Trim is light on dark underwear and dark on light, so black underwear shows on a dark card. "Dark" and "light" with no colour are now dark and light rather than the theme accent; "ivory" is light.
- **Rounds of one act add to the conception chance.** Every ejaculation counts, but each next one adds less: the second round adds 15% of the first's chance, the third 7%, then 3% each. At the cycle peak this is a few percent, not a doubling, as in real life: each next one has fewer sperm, and there is one egg. If more rounds appear, the threshold of the same act rises and the dice stay the same.
- **Acts within one fertile window no longer roll independent dice.** Six acts in a row in the window gave about 80% per cycle, while in real life it is about 37%. Now the window has one roll and the threshold is the combined chance of all its acts (Schwartz model, viable cycle 38%). An act every day of the window gives about 37%, every other day about 35%, a single act its own chance as before. Under the act's risk you can see the combined figure.
- **Music: finding a track.**
  - Covers, remixes, edits, sped-up and slowed versions, karaoke and backing tracks are no longer taken instead of the song. The exception is when the model wrote it itself, for example "(Remix)": then that version comes first. A live recording is taken only if there is no studio one. A remaster, "Stereo Mix" or "Radio Edit" is the song itself.
  - The artist has to match by name, not by one shared word: a made-up "Lunar Echo" no longer finds a song by "Echo". Co-artists, "feat.", "and" and "+" still count.
  - A full track tries several versions: if the first gives no sound, the next one plays, and only then the 30-second preview. A paid song that the service served as a preview instead of the whole thing is skipped for another version.
  - A network or server hiccup gets one more try a second later. If the main proxy does not answer, the search goes through a backup, and the sound comes by a direct NetEase link via Meting.

### Fixed
- Two acts at the same time with the same partner on different days counted as one and shared a roll: the act key had no date.
- **X-ray in the second round.** With semen left inside from before ("filled with the first round's cum"), x-ray stopped the thrusts and showed ejaculation although the second round was already going. Now the penis moves at its own pace, the semen lies still in the canal, and the label says "semen inside". A pause between rounds ("stays inside, hardening again") is still "after".
- X-ray recognises thrusts written as "прошивает", "пробивает", "раз за разом", "снова входит до упора", "движения тазом". "Heartbeat thuds" and "swollen from the thrusts" are not thrusts. A wish to "make him come inside" no longer draws semen.

## 23.88.102 — 2026-11-09

A second check of the conclusions HUD draws itself.

### Fixed
- **Names.** Two characters of one card ("THE CLUB  Mark Grey" and "THE CLUB  Anna Grey") counted as one person by the shared first word of the prefix: the prefix no longer takes part in the comparison. Short names with two consonants no longer merge on two edits: "Nina" and "Нона", "Kim" and "Кай" are different people, "Nina" and "Нина" are one.
- **Protection during intimacy.**
  - Oral sex alone ("oral", "cunnilingus") now carries no conception risk, even when the field says "none: no protection". "Oral contraceptives" are still pills.
  - "No ejaculation inside" and "ejaculation control" are withdrawal, not "no protection".
  - An emergency pill (ulipristal, Ella, Postinor) is emergency contraception, not ordinary pills.
- **Sleep.** "slp: 7" means seven hours: a bare number used to be lost, and the night dropped out of Daily life. "slp: 0" works as before, without an empty night.
- **Debts in Money.** "A debt of honour", "forever in her debt", "the struggle between duty and desire", "must be back for breakfast" counted as money debts. Now a debt needs money nearby: an amount, a currency, a loan, an IOU, interest, a lender, a bookmaker.

## 23.88.101 — 2026-11-09

A check of the places where HUD draws a conclusion itself, without a field from the model.

### Fixed
- **Character sex.** Without an "M/F" mark in Appearance the sex was almost never found, and a "tattooed chest" on a man or "women around" made him a woman. Now HUD reads words about the person themself (only "woman", "man", not "women" around), the role at the start of a part ("Wife of…", "Heir…", "fake husband"; on a tie the first role wins) and short participles of the state (masculine or feminine forms, at least two ahead). The sex feeds the body in the scene, the calorie norm and daily life. On the test chats the sex was found in 1672 records instead of 675, with no errors (there were 5).
- **"Unconscious" is not put on sleep.** "Passed out into a deep drunken sleep" or "dropped off in class" when the body says she fell asleep is sleep. Colloquial "passed out", "switched off" next to sleep no longer give the plate; "unconscious" and "fainted" work as before.
- **Weather for clothes.** "Snowstorm" and "snow squall" now count as snow, and blizzard, storm and squall also as wind.
- **The daily-life line for the model.** Instead of one entry per person ("sleep debt for Anna 7 h; sleep debt for Mark 14 h") it is one: "sleep debt: Anna 7 h, Mark 14 h". The same for "night after the fight: Name 4 h".
- A breakage in daily life does not count when a cheekbone or a nose is broken rather than a thing; "bath" in a mention ("the truth about that bath") is not washing.
- Contrast check: family tree branch labels take their colour the same way as the rest of the text.

## 23.88.100 — 2026-11-08

### Added
- **"What's new" window.** After an update the HUD shows once what changed, right in SillyTavern. All versions since the last time are expanded, with a collapsed history below. The text comes from this changelog in the interface language. At the top of the settings there is a "📰 What's new" button and a checkbox that turns off the automatic window.
- **Cancel for lorebook entries.** While the model writes an entry, the "Write with the model" button becomes "Cancel". Closing the window and the timeout also stop the request, and the fields stay untouched.

### Changed
- **Profile lists update on their own.** When a profile is created, changed, deleted or switched in the Connection Manager, the regeneration, assistant and music lists pick it up at once. Music also has its own 🔄 button. If the profile chosen for music was deleted, music goes through the chat model.

### Fixed
- **Cancel now really stops the model.** Before, with a request through the chat model, the button only removed the waiting state while the model kept writing and spending tokens. Now the request stops for music, playlists, the assistant and HUD regeneration. In the assistant window the "Ask" button becomes "Cancel" during a request, and the question returns to the field after cancelling. A music selection cancelled during track checking is not saved.

## 23.88.99 — 2026-11-08

### Changed
- **Family tree settings moved to "Memory and plot".** The tree checkbox and the "HUD messages for the family tree" field are now under "HUD blocks → Memory and plot" instead of "Characters". Setting values do not change.

## 23.88.98 — 2026-11-08

### Changed
- **On phones, long lists no longer scroll separately from the HUD.** Rows with four or more pills were small windows with their own scrolling, and a finger landed either in the list or beside it. Now three pills and the edge of the fourth are visible, with a "More N" button below. A swipe always scrolls the whole HUD, and an expanded list scrolls with it. "Collapse" folds it back. On desktop nothing changes.

## 23.88.97 — 2026-11-08

### Changed
- **The family tree can be read by its layout.** Before, it ran as one long line and shrank to tiny labels. Now each unconnected family is its own branch with a label of surnames, and branches go in rows from top to bottom. A couple stands under their parents, each with a straight line down. A wife's brother and a husband's twin stand next to the person they are related to.
- **Former spouses with no child together are not shown in the tree.** A former wife or husband with a shared child stays. If such a person has their own relatives in the tree, they stay in their own branch, with no marriage line.

### Fixed
- **The tree's "Fit" button is replaced with "Whole tree" and "Normal size".** Before, it often did nothing: the tree already opened fitted to width, and height was ignored. Now the button shows the whole tree by width and height, and a second press returns the full size where labels can be read.
- **English interface of the tree and Health.** Kinship labels on lines and couples and the "No sleep" label no longer stay in Russian.

## 23.88.96 — 2026-11-08

### Fixed
- **Weight returns to the previous HUD when a message is deleted.** The rollback happens right at deletion, and the card of the last turn is redrawn. Before, the weight stayed from the deleted reply if another message or a swipe with no weight took its place. Calories, activity and height return with the weight. If the second reply of a story day is deleted, the weight of the first one returns. After a rollback the model is asked about the weight again without waiting two days.
- **Trust scars and event marks roll back the same way.** A scar lives as long as the reply it appeared in.
- **Deleting a message higher in the chat loses nothing.** Weight and scars follow their reply as its number shifts. Before, scars could disappear for no reason.
- **Family tree.**
  - "Son-in-law" and "daughter-in-law" used for a sister's husband or a brother's wife no longer give the person a second, unknown spouse. In Russian one word covers both meanings.
  - Labels and cards no longer show the prefix from the card title: instead of "father · TITLE" there is a name.
  - Notes in brackets after a name, such as "(in absentia)", do not create a separate person.

## 23.88.95 — 2026-11-08

### Added
- **Relatives from past HUDs in the family tree.** The settings now have a "HUD messages for the family tree" field next to the tree checkbox: 0 to 500, 100 by default. Relatives who left the scene long ago stay in the tree. One pair of people gives one record, the most recent: no copies and no old "wife" next to a new "ex-wife". At 0 the tree reads only the current HUD.

### Changed
- **`nc` is also allowed in health, status, inventory, body marks and illnesses.** The rule for the model is strict: `nc` only if nothing in the field has changed since the last HUD. The slightest shift, or any doubt, means the field is written in full. An empty field stays empty.
- **Weight is now asked as an update.** If a weight is already recorded, the model answers whether it went up, went down or stayed as before, and "as before" is normal. `same` keeps the weight and updates the date, `up` and `down` come with a new number. With no number, the HUD moves the weight by 0.3 kg. Someone with no weight yet is asked for height and weight as before.
- **Reminders follow the last HUD.** A trust wound, the mark of an event and the rival reminder go to the model only if both people are in the last HUD. The request to fill in what was eaten is not sent about someone who is not there.

### Fixed
- **`nc` no longer shows on screen.** The model sometimes wrote `nc` in fields the HUD did not expand, and it stood on the card as is. Now `nc` is replaced by the previous value in any field: for characters, the player, the scene, the world and the phone. Optional fields come only from the last turn, so a long-past illness does not return. Replies already received are repaired when shown.
- **Someone else's "twin" in the tree and graph.** An entry like "X: younger twin" in a third person's relationships made that person X's twin. Now a twin is a pair: a mutual record is true, and someone else's does not count if the person already has a confirmed twin or several people call them that.
- **"Twin brother" and "twin sister" written with a hyphen in Russian now count as kinship.** Before, such an entry did not reach the tree, and neither did "older brother and main support".

## 23.88.94 — 2026-11-08

### Changed
- **Weight is more realistic.** The model is asked every 3 story days instead of weekly, and in tenths: 48.6 kg. The model's number now shows where the body is heading, and the HUD decides how far it could have moved: 0.25 kg for water and food plus 0.15 kg a day. That is at most 0.4 kg in a day, 1.3 kg in a week and almost 5 kg in a month. Swipes count from the previous day and do not add up. It can move faster only after childbirth, amputation or major surgery: the model marks such a record with the word `sudden`. Old records are not recalculated.
- **The weight change shows its period:** "-0.6 kg over 3 d", "-2 kg over 5 mo". Before, "-2 kg" looked like a one-day loss.
- **Music: going back to a track without waiting.** The last five tracks stay in memory with their downloaded start. First, second, then first again starts at once with no network, from the beginning. The memory lasts 15 minutes, because links to full tracks expire.
- **Music starts faster.** YouTube mirrors are asked all at once instead of one by one, and a silent mirror is replaced by the next one after 7 seconds. The link to the next track is prepared in advance, and NetEase does not search again for a track it already found.

### Fixed
- **Fears with no subject.** The model sometimes wrote only the strength in the field, and the screen showed a bare "low". Such an entry is now hidden, and the model is told not to write it.
- **Health on the phone.**
  - "Pulse 0", which the model writes when the watch is silent, no longer draws a point at zero.
  - "No data" no longer counts as sleep, and "no sleep (night shift)" is shown briefly, with the reason in small print.
  - If the phone's owner is not found, another person's pulse and body are not shown. The player's phone takes the data from the player's block.
  - Steps "8,500" are read as 8500. Today's value is the highest one, as in the bars by day.
- **Life.**
  - The temperature "-4.5°C" was read as +5, which caused a false "not dressed for the weather". Decimals and the sign now count, and Celsius wins over Fahrenheit.
  - The "main person" changed every turn because the model lists people in a different order, and the satiety of different people produced a false "ate". Now there is one main person: the hero of the card.
  - The transactions "Yesterday" and "12.10" are read as dates, and one purchase counts once.
  - The date in a timeline entry "20:42 (15.05) - dinner" sets the day of the event and stays out of the text.
  - An item like "dry dark hoodie" in Russian no longer drops out of "wearing".
  - "Worn N times" counts separate outings, not turns.
  - "In the laundry" clears after washing, and "ran out" clears after buying.
  - The summary shows only the main person's night, never someone else's. A night after midnight is not counted twice.
  - A balance of "1,500" is read as 1500. "After a shower and dinner" now counts as both food and washing. Long entries in "Broken" are shortened.

## 23.88.93 — 2026-11-08

### Changed
- **The "First-aid kit" view of Health is a real kit now.** The line about how the person feels stays on top, as before, and the cards of illnesses, marks and "Forever" lie in a closed case: a handle, latches, a cross and a label with the number of entries. A tap opens the case to full width and shows everything. The open case stays open after the HUD redraws. The case takes its color from the theme accent, including a custom theme you built yourself; in Vamp it is dark wine.
- **Cycle: badges are small chips.** "Fertile window", "PMS window" and "until the period" in the Moon and Flower views stood as a separate full-height column, like big empty tiles. Now they are chips under the dates next to the disc.
- **The libido chart spans the full width.** Before, it took at most 420 pixels and left half of a wide card empty. The height is fixed, and the "today" circles and dots are not squashed.
- **Relationships: cards in the strip are one height.** In the sideways strip, short cards stood over empty space next to a tall one; now all stretch to the tallest, like the Trust cards.
- **Place and Role have a lighter background.** The backing under them is lighter, so the theme picture shows through better. The cards themselves are unchanged.

### Fixed
- **A morning "after the fog" is no longer foggy.** The weather "clear sunny morning after the fog" turned on the fog scene: the HUD found the word "fog" before "clear", and the whole scene went pale and milky. Now "after the fog", "the fog lifted" and the Russian equivalents do not count as fog, the same as "after the rain" already did.
- **Schedule: day and time apart for a long date too.** A line like "Sunday, 16.05.2027, 07:15 — breakfast" was not parsed: the part before the time was longer than 24 characters, so everything went as one text under "during the day" with a dash. Now the date is on top, the time is large, and the event is below. Without clock time, a part of the day counts as the time: "…, afternoon — moving" shows "afternoon" large.
- **Place: the "you are here" circle is not clipped.** The pulsing halo around the last stop went past the edge of the list and was cut off.

## 23.88.92 — 2026-11-08

### Fixed
- **Conception risk is counted by the day of intimacy, not by today.** Before, the risk and the dice used today's cycle day: a month after intimacy the block showed today's risk, and if the model rewrote the "Last sex" record, a new roll was made for it and the test changed. Now the risk of an act uses the cycle day on the day it happened. A roll is made only for a recent act, at most a week old. An old act seen for the first time gets no roll of its own, and a roll made earlier stays valid.
- **The "(!…)" mark no longer shows in Relationships.** It is the trust-wound mark: the model sometimes carried it over from Trust into Relationships, where it showed as is, e.g. "childhood friend (!lied about the main thing)". Now it is removed, and ordinary brackets stay. The model is told the mark lives only in Trust.

### Changed
- **The cycle block shows two conception risks.** "Today" is the risk if intimacy happens today, without protection. "On the day of intimacy", with its date, is the risk of that act, and the test belongs to it. If the act was today, there is one line. If the last act is older than a week and has no roll, only "Today" stays, with a note that its risk is not counted.

## 23.88.91 — 2026-11-08

### Changed
- **Trust scars are rarer, as a reminder.** The note "she still carries a wound from him" goes to the model once every eight replies instead of every three, and is worded as a reminder: the wound is there and may show now and then, not in every scene. A new or changed scar still arrives right away.

## 23.88.90 — 2026-11-08

### Added
- **Archive: complications and the course of a pregnancy.** A pregnancy card now has:
  - how it goes or went, with a history that expands below: "developing steadily", "kept despite the crisis", "ended" — with date and time;
  - symptoms and the doctor visit;
  - check-ups at weeks 12, 20 and 30: "all normal" or what was found;
  - the threat of loss and its outcome;
  - the complication of a loss (surgery, injury or infection) and what happened, in the model's words.
- The archive does not reveal check-ups and threat outcomes you have not opened: they read "not opened", as on the card.

### Fixed
- **Dreams: nightmares and ordinary dreams.** HUD looked for a nightmare by a single word. "Кровать" (bed) matched as "кровь" (blood), "намертво" (tightly) as death, and warm protective dreams became nightmares. A dream with "scarlet water rising to the ribs", a fall "in a cold sweat" or a collar "pressing on the throat" did not count as a nightmare. Now HUD weighs fear against calm: strong fear (blood, death, choking, a chase, a fall into the abyss) weighs more than a hint (behind the back, a cell, icy fingers). Warmth and safety reduce it. "Without nightmares", "instead of choking", "not letting her fall" do not count as fear. A dream where the fear resolves into calm ("but when she turns, he shields her") is ordinary. On 52 dreams from the chats, 6 were corrected: four became nightmares, two stopped being ones.
- "Last night…" at the start of a dream no longer makes it a memory.
- **Trust reasons without a leading comma.** When the model wrote "+15, stood up for her", the reason in the archive and on the card started with a comma. The number and the marks after it are now removed; "for what" stays.
- **Dashboard checkboxes and archive sliders match the theme.** The archive window used plain browser checkboxes instead of the theme ones from the settings.
- **Companions in theme colours.** The card and the tamagotchi were always orange (for a cat) or in the species colour. Now the band, border, tiles, mood and skills use the theme colours; the species colour stays only on the pixel pet.
- **The archive dashboard did not see hidden turns.** Messages hidden with /hide were skipped entirely, so in a chat with a hidden history the dashboard saw only the latest turns: "NSFW scene frequency" was empty although the HUD had intimacy, and "Chat health" and "Who talks more" counted a small part of the messages. Hidden turns now count as history; SillyTavern service messages (help, narrator) do not.
- "Who talks more" and "Who mentions whom" show the name without the card prefix.
- English interface: no Russian hint about dates from the tag is left in the archive statistics.

## 23.88.89 — 2026-11-07

### Fixed
- **Duplicate secrets and guns.** The model rewrites a secret in its own words every turn, and the archive merged only identical text: one secret about the cat turned into a dozen cards. Now similar wordings gather into one record. Rare words are compared, while character names that appear almost everywhere weigh almost nothing. Two secrets of the same turn are never merged. On the test chat secrets went from 94 to 25, guns from 337 to 201.
- The same place in a row no longer repeats in the Timeline when the model rewrote only the tail of the address ("three metres" and "three and a half metres").
- A name with the card prefix and without it is now one person in secrets, relationships and statistics.
- A cached report from the old format is recalculated by itself.

### Added
- **A secret as of the latest moment, and its history.** On top: the latest wording, the status and who knows. Below, "Who learned it and when" expands: date and time, the name, how they learned, status changes and the first wording. Guns work the same way: the state on top, "Thread history" below.
- **Date and time next to turns.** Every turn number in the archive now shows the scene date and time of that turn.
- **All pregnancies.** The tab shows not only outcomes but every pregnancy by turns: from which week to which, story dates, the father, who knows, how it goes, the expected birth. The outcome (birth, miscarriage, abortion) comes from the mark. A pregnancy that left the HUD long ago without an outcome reads "no news". The chronicle now keeps the pregnancy field too, so this works in cleaned chats.
- **Fewer reply tokens: the model writes a shorter HUD.** Three new switches in Generation, all on:
  - **"nc" for what did not change.** Appearance, clothing, kinks, fetishes, no-gos and last sex are written as a short "nc" (no change) when they are word for word the same as in the last HUD.
  - **World once per story day.** News, rumors, forecast, rates, events, city, ads and the horoscope are written in the first HUD of a new day or when something in them changes. Comments are written every turn.
  - **Memory as updates only.** In facts, guns, secrets and the day log the model writes only what is new or changed. An item is removed with a minus in front of it, and a fired gun goes away after one turn, as before.
  - Right after the reply the HUD expands all this into a full HUD and saves it in the message, so the card, the archive and the snapshot for the next turn see everything in full. On a long test chat these fields took about 14,000 characters of each reply, most of it repeated.
- **Provider cache for Chat Completion** (switch in Generation, off). The constant part of the instruction — task, rules and schema — goes to the start of the request, so providers with a cache (DeepSeek, OpenAI, Gemini, OpenRouter, Claude with caching on) read it more cheaply: that is 9–12 thousand tokens every turn. The last HUD snapshot and the turn notes stay at the end. Experimental: if the model starts writing the HUD worse, turn it off.

### Changed
- **The archive looks better.** Tabs are pills with icons and record counts. Cards have icons instead of emoji and a coloured stripe by the secret level or the state. The status is a coloured badge. In the Timeline the date is a day header with places under it and their time. The chat under the archive window is blurred and no longer shows through the report.

## 23.88.88 — 2026-11-07

### Fixed
- **Archive: the chosen chat no longer drops.** If you picked a copy or a branch of the open chat, the list showed "only own" again after the archive was closed. Now the chosen chat is remembered in the chat itself and stays chosen the next time the archive opens and after a page reload. You can pick another chat or "only own" in the same place.
- If the chosen chat got new messages since last time, the archive reads it again before the analysis, and the old cached report is not shown.
- The hint under the list no longer shows a negative number of turns missing from the chat.
- **Calendar: no more miscarriage.** A pregnancy loss stood in the calendar as a memorial date and a year later as an anniversary: an old miscarriage sat in Soon half a year ahead and looked like a new event. Now losses don't go to the calendar at all; they stay in the archive's Pregnancies tab and Timeline.
- **English mode: the HUD no longer carries Russian forward.** If a chat started in Russian, the model updated the last HUD and kept Russian values mixed with English ones. The instruction now ends with a short line: write every HUD value in the language chosen in the settings, even if earlier HUDs used another one. The line is there in both modes, Russian and English.
- In English mode the built-in assistant prompt in the settings field is shown in English too: its example references are no longer Russian.

## 23.88.87 — 2026-11-07

### Added
- **Remove a person from Daily life by hand.** Each person in weight, sleep and wardrobe now has a trash button. After the "Are you sure?" question, their weight, sleep, wardrobe and wounds leave the tab and the card, the model stops counting them and no longer asks for their weight, and the summary follows the next person in the scene. The records stay: bring the person back at the bottom of Daily life, under Not counted. Each chat has its own list, and you can remove yourself too.

### Changed
- On the weight card the number sits on the right, next to the button, not in the middle.

### Documentation
- Both READMEs now cover removing a person from Daily life, the checkboxes for new features, the Model notes and On-screen hints sections, the question before deleting, swipe behaviour, fast chat opening and attaching another chat to the archive.

## 23.88.86 — 2026-11-07

### Fixed
- **Archive: adding another chat.** The list no longer falls back to "looking for chats" and searches again: the chosen chat stays visible while it is read. A branch or copy of the open chat now says that its turns went into its own chronicle, which used to look like a reset to "own only". If a chat cannot be read, the list comes back.
- **Stale lines in the model's hidden facts.** The model no longer reads "no signs, nobody knows" about a pregnancy already in the HUD or twins the HUD already writes. An old encounter no longer keeps "not pregnant" alive for years.
- **Neglect after a time jump.** Someone who was out of the scene or went through a jump no longer shows as "150 days without sleep": the count starts over.
- Plates with long text in a narrow cell on PC no longer squeeze into word-wide columns.
- Names in plates with people wrap by word.
- Weight: calories and activity update when a swipe changes only them.
- A trust shift no longer stays on the place of a player message when the chat has shifted.

## 23.88.85 — 2026-11-07

### Added
- **New switches in the main settings:** question badges, one-time nudges, invitations, thread deadlines, pregnancy check-ups, the threat die, miscarriage and abortion, intimacy reminders.
- **Fine tuning, "Model notes" section:** scars, impressions, rivals, each body detail, neglect, the weight request, holidays, deadlines and invitations separately.
- **Fine tuning, "On-screen hints" section:** intimacy reminders, question badges, one-time nudges, check-ups by week and the threat die.
- Invitations are now in fine tuning among the Memory fields.

### Fixed
- With Neglect turned off, it no longer shows on the card or affects the cycle and the chance of conception.
- With Weight turned off, it also leaves Daily life, not just the card.
- With Scars turned off, the model is no longer asked to write the reason for a trust shift.

## 23.88.84 — 2026-11-07

A logic check of the new features on a real chat.

### Fixed
- **Weight: swipes no longer create a fake gain.** Every swipe went into the history: one day could collect "47, 48, 47, 48 kg", and the card showed +1 kg. Now one turn is one record, and the change is counted from the previous day. Old chat records are read the same way.
- **Weight after deleting messages.** If a reply with a weight is deleted, a new weight from an earlier place in the chat is no longer rejected, and the deleted one leaves the history.
- A baby's weight under 10 kg is now recorded.
- The calorie norm no longer treats a man as a woman when the appearance does not start with the sex, such as "tall man", and it finds a person by a short name.
- **Swipes and model notes.** A wound, an impression or a rival from the reply being replaced no longer reaches the model as something that already happened.
- **Invitations.** "Не приеду" and "не согласна" counted as acceptance, so the model was told the player had promised to come. Unclear answers now ask the player, and "can't be there" and "won't be there" count as refusals.
- An invitation from a reply that was swiped away or deleted no longer stays as an open question.

## 23.88.83 — 2026-11-07

A big check: 28 themes, both eras, both languages, all block views, PC and phone.

### Fixed
- **The Customize window on light themes.** All ten light themes showed a grey veil and pale, blurry labels: the SillyTavern tint and text shadow were made for a dark surface.
- **The banner header in a narrow card.** The date ran over the name, and in Vamp, Kawaii and Ice the name broke into a column of two letters.
- **Bullet Journal.** The tape covered the title and the question counter, the Twist label had no visible text, and on phones the name broke letter by letter.
- The trust bars and the body map in a strip no longer tear labels apart.
- The Moon and Flower cycle views in a narrow card: the text moves under the picture instead of squeezing into a column.
- A long name in a plate with people wraps instead of being cut off.
- Tea Party: the labels on a collapsed card are readable again.
- On light themes the weight change, the pulse on the ECG monitor and the forum labels are now visible.
- The text on the profession plate is visible again in Web 1.0.
- Newspaper: "Price" and "Stop the press" are no longer white on paper. Paper blocks no longer have a dirty halo around the letters.
- The note under the status stamp is readable on dark themes.
- Companions: three tiles in a row no longer cut words.
- Narrow card: the horoscope no longer clips signs, pregnancy no longer squeezes text to 55 pixels, ultrasound labels no longer overlap, and the state batteries no longer cut words.
- The Twist text no longer runs under the corner ribbon.
- The Customize window no longer shows a stray checkbox above the card.
- Turning off appearance or clothes in fine tuning no longer marks every character as off-scene.
- If the model sends an object instead of a string, most fields now show it as text, not "[object Object]".

### English interface
- Translated: the due date countdown with an estimate, sleep debt, API key errors, the "before the edit" version label, calendar tasks, "secret" in kinks, the "loss" label and ages over three.
- The baby's age in the model instruction is now in English.
- On the trust orbits, "свои" is no longer translated as "custom".

## 23.88.82 — 2026-11-06

### Fixed
- **Plate lists now follow the finger.** Wounds, illnesses, marks and other lists no longer skip half a card: a 220-pixel swipe used to carry the list 460 pixels.
- A long list now fits inside the tab window, so you can see it scroll. The window was 300 pixels, while a list could reach 1250.
- If a list is only partly visible, the swipe moves the tab instead of scrolling plates out of sight.

## 23.88.81 — 2026-11-06

### Changed
- **Chats open faster.** Tavern no longer colors the HUD block as code, since a card replaces it right away. On a 300-turn chat the text appeared about 13 seconds sooner: after 7 seconds instead of 20.
- The card of the latest turn is built first, and older turns follow in small portions, so the screen freezes less.

### Fixed
- **A finger scrolls through the whole turn.** At the end of a list the swipe carries on into the tab body and then the chat. On phones the feed no longer stops at the tab body.
- **The Unconscious plate no longer shows for someone else's state.** Thoughts and subtext no longer count: "he passed out" in another character's thoughts doesn't give that character the plate. Another person's name or "our lord" next to the word doesn't count in other fields either.
- The plate now also understands the Russian slang «отрубился» and «в отрубе».

## 23.88.80 — 2026-11-06

### Added
- License: the code is released under GNU AGPL-3.0. Images and screenshots are not covered, see NOTICE.md.
- The manifest author is now alewwi, and the code carries a credit notice.

## 23.88.79 — 2026-11-06

### Added
- An "Are you sure?" question before deleting: a scar, your stat, your theme, images, avatars, music lists, clearing the cache and restoring a built-in prompt. The dialog says plainly whether it can be undone.
- Dialogs for deleting pills, a pregnancy and a loss now ask the same way and explain what gets erased and how to bring it back with ↶.

### Changed
- The Body field asks the model for the person's state, not a retelling of their actions. Physiology asks for sensations, not actions.

## 23.88.78 — 2026-11-06

### Fixed
- After answering a question with a badge, the card jumped back to the first tab: the number on the badge changed the tab label.
- The Unconscious plaque squeezed its text into a thin column on a narrow card.

## 23.88.77 — 2026-11-06

### Changed
- The note about losing one of twins or triplets works the same way: it goes out only until HUD has recorded the loss, and comes back if it forgets before recovery ends. It no longer goes out after the birth or in a new pregnancy.
- Swipe and Continue look at the HUD of the previous message, not at the reply being rewritten.

## 23.88.76 — 2026-11-06

### Changed
- The "pregnancy is over" note goes to the model only until HUD has recorded the loss. If the model forgets it before recovery ends, the reminder comes back. A cancelled loss or a new pregnancy gives no reminders.

## 23.88.75 — 2026-11-06

### Changed
- This Turn notes about scars, lingering impressions, rivals and the neglected state go to the model once every three replies, and at once if they change.
- A scar no longer tells the model that trust will be rebuilt.
- A removed scar does not come back when the same wound is repeated: only a new fall in trust brings it back.

## 23.88.74 — 2026-11-06

### Added
- Translucent intimacy reminders: on the loss plaque, in the postpartum card and on a fresh wound on the torso. The date depends on the term and complications, and the line goes away once it has passed. The model does not see them.

## 23.88.73 — 2026-11-06

### Added
- Settings file: all settings, customization, your themes and stats and images save to one file and load back. API keys and passwords stay out of the file.
- A badge on the tab where HUD is waiting for your answer: invitations, "came up in an argument", a closed threat outcome and check-up. The same number shows in the header of a collapsed card and on the stub when the side panel is closed, and a tab with a badge goes straight to the question.

### Fixed
- Invitations did not show in Memory when it had no Important block.

## 23.88.70 — 2026-11-06

### Fixed
- Nudges and turn notes lost the generation type: a nudge dropped on the first swipe of a new reply, and notes were rebuilt.
- Sleep hours were read as a scale, so almost everyone landed in the neglected state.
- A wound at zero trust did not show, and repeats made duplicates. Now there is one scar per pair.
- Men were counted as women in the calorie norm.
- A reason like "-5 for the reproach" loses the number.
- Overdue plans no longer flood the request: only the last week and two per turn at most.
- The sample no longer mixes the real chat into weights.
- The Miscarriage or abortion button finds the father and who knows in past turns.
- The archive keeps trust rows with a reason, a scar or a big shift.

## 23.88.68 — 2026-11-05

### Added
- The neglected state now counts water too, lowers the chance of conception and disturbs the cycle.
- The calorie norm accounts for activity, which the model writes with the weight.
- Overdue plans are marked in the phone calendar, and the model settles once whether they happened or were missed.
- Holidays follow faith if the card, persona or roles name it: Orthodox or Western Easter.

### Changed
- Only clear agreements go into the phone calendar.
- The help for network comments now describes people inside the world.

## 23.88.67 — 2026-11-05

### Added
- **European holidays:** a shared list plus a national day for France, Germany, Italy, Spain, Ireland and the UK. Independence Day for the USA and Victory Day for Russia.
- **Weight and height on the character card.**

### Changed
- In the sample, the miscarriage now belongs to a separate person, Mira Sol, and everyone has a weight.

### Fixed
- Brackets in a name no longer count as a reason for a trust shift.
- "Going to sleep" no longer counts as accepting an invitation.
- Weight finds a person under another spelling of the name, and the request pauses for two weeks after three unanswered asks.
- A thread deadline understands a date without a year.
- Deleted messages take their scars along, and Remove pregnancy also clears the log.
- No pregnancy signs show while nobody knows about it.

## 23.88.66 — 2026-11-05

### Changed
- New plates look better: threat and check-ups with icons and a dice bar, a stitched scar, an envelope invitation, colored thread deadlines, weight cards with a curve and a food bar.
- The HUD sample shows everything new: scars, trust reasons, weight, an invitation, a threat, check-ups, a loss, thread deadlines.
- All new blocks have help question marks.

## 23.88.63 — 2026-11-05

### Added
- **One-time nudge for the model.** A star button on Important, guns, secrets, rumors, news and shared memories: the pill you tap goes into the request for the next reply. HUD never creates a message itself. The nudge holds for one reply and all its swipes, and a new message clears it. The queue shows above the input.
- **Relationship scars.** The model briefly writes why trust moved, right in the trust field. A deep wound or a drop of 15 or more leaves a scar: the model remembers the hurt until trust returns. After a big shift a character stays under the impression for a few turns, and a rival's gain costs the player.
- **Trust chart in the archive:** a pair's shifts and reasons on the Relationships tab.
- **Living details.** The model shows hunger, tiredness, stress and more through small details, with pauses between them.
- **Neglected state.** Days without food and sleep show on the card and in the story.
- **Weight and calories.** The model writes height and weight once, HUD asks to update them weekly in story time. Daily life shows the weight, its change and a calorie norm that accounts for pregnancy.
- **Pregnancy check-ups** at weeks 12, 20 and 30: complications and the baby's traits; you reveal the result and can change fate. Serious findings have their own checkbox.
- **Pregnancy disclosure modes:** by era, modern, medieval, omniscient.
- **Pregnancy log** in the archive, with a file download.
- **Holidays of the era** in the phone calendar, a light background before them and a short recap after.
- **Invitations.** HUD reads the player's answer itself, and shows an Accept and Decline card if it can't. Promised and didn't come: the character is hurt.
- **Deadlines on plot threads:** a date and task kind on a gun, the deadline in the calendar, and an overdue thread asks for a resolution.

### Changed
- **Network comments** now come from ordinary people inside the world: their own nicknames and places, no knowledge of private scenes, no talking to the reader.
- Older Important items fold away.
- The model records plans only from clear agreements.

## 23.88.59 — 2026-11-05

### Fixed
- **Phone icons are fully built from the theme.** The drawing used to only shift its hue, so stray colors showed up on palettes and other themes: a purple harp in an orange theme, a green cat in a lilac one. Now every color of a set is worked out from the theme: the drawing, outline, inserts and glass take the accent and the hues next to it. Skin on portraits stays natural.
- **The icon background always matches the theme background.** A tile is no longer light on a dark theme or dark on a light one. Parts of the drawing that would merge with that background flip to the other side in lightness. An accent too close to the background also gets easier to see.

## 23.88.58 — 2026-11-05

### Added
- **Phone icons by theme.** Each of the 27 themes has its own set of twelve icons: objects that fit the theme, its own tile shape and its own look. Pirates get a speaking trumpet for Calls and a chest for Wallet, Egypt gets an ankh for Health, Medieval looks like stained glass, Web 1.0 is pixel art. Contacts are told apart by headwear and silhouette, with no drawn faces.
- **Icon choice in Customize.** Blocks: Phone now has an App icons list: Auto by theme, Regular (the old icons), or any set.
- **Icons follow the theme.** A set from another theme shifts its hue toward the theme accent: Biopunk turns red in Vamp. The tile takes the theme background color. If the drawing would get lost on that background, the tile is made from the theme accent instead, dark or light.

### Changed
- An icon set loads only when it is needed. The regular icons may show for the first second.

## 23.88.53 — 2026-11-05

### Added
- **Miscarriage and abortion.** The model marks the end of a pregnancy with `lost`, or you press **Miscarriage or abortion** in the card and pick the kind and date. HUD closes the pregnancy for that character only, tells the model on the next turn and keeps the history. **Cancel** restores everything.
- **Twins and triplets.** Only some of the babies can be lost: the pregnancy goes on with those who remain.
- **Threat dice.** When the pregnancy field mentions a threatened miscarriage, HUD rolls for the outcome. The chance depends on the term and severity. You reveal the result and can change fate, and the model gets it only after that.
- **Recovery by term.** Bleeding, the return of the cycle and milk depend on the week of the loss. Milk appears only late in a pregnancy.
- **Chance of conception after a loss.** Almost none before the first ovulation, a bit lower until the first period, then normal. It stays slightly lower for about three months after surgery, trauma or infection.
- **Pregnancies tab in the archive:** all births and losses of the chat and who knows about them. Losses also show in the archive Timeline, and a miscarriage shows in the calendar as a memorial date.
- **Remove pregnancy:** erases a pregnancy from the HUD of the whole chat, as if it never happened.
- **Delete from HUD per pill** in Important, Chekhov's guns and Secrets, with a list of similar wordings to choose from.
- **Undo deleted items** through ↶ in the card header. An item returns to edited blocks and to the latest HUD too.
- **Stale copy warning.** After a deletion or restore on another device, HUD offers to update the chat and asks before saving over it.
- **Remove service files** in the settings: puts offloaded HUDs back and clears offload files and the chronicle before you uninstall.

### Changed
- Long lists keep three plates, then scroll right on PC and down on phones.
- The body and physiology fields split only on `;`. Commas inside a phrase no longer cut it into pills; a short list like "hunger, thirst, chills" still splits.

### Fixed
- Several English gaps: "no change for N turns", the protection chance line, the fight total, trimester names.

## 23.88.19 — 2026-11-02
- Unload the chat: old HUDs go to SillyTavern files, summaries stay in place.

## 23.88.18 — 2026-11-02
- X-ray: no fork-shaped fingers, slimmer long shaft, still frame mid-stroke.

## 23.88.17 — 2026-11-02
- X-ray of a second round: no false tongue row, thumb on clit as rub, no past climax.

## 23.88.16 — 2026-11-01
- No black plate under field views on picture themes.

## 23.88.15 — 2026-11-01
- X-ray: a long shaft gets thicker with its length.

## 23.88.14 — 2026-11-01
- X-ray size from words and the card, conception chance per act, phrase pills.

## 23.88.13 — 2026-11-01
- Theme-tinted backings for dark views; pill lists show two or three.

## 23.88.12 — 2026-11-01
- English gaps in built strings, casket tabs on phones.

## 23.88.11 — 2026-11-01
- Player custom stats named in the template; group chats get members' cards.

## 23.88.10 — 2026-11-01
- Medieval era: chosen block views restyled for the period.

## 23.88.9 — 2026-11-01
- Player: custom stats, all character fields, in-card field edit; English gaps.

## 23.88.8 — 2026-10-31
- Custom stats, deep field tuning, conception-chance breakdown, theme fixes.

## 23.88.7 — 2026-10-31
- Remove HUD from a chat, settings shared across devices, English lookup fix.
