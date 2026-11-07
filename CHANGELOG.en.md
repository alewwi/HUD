# Changelog

[Русская версия](CHANGELOG.md)

All notable changes to TavernOS HUD, newest first, starting from version 23.88.7.

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
- **The Unconscious plate no longer shows for someone else's state.** Thoughts and subtext no longer count: "drunk Tristan passed out" in Ares's thoughts doesn't give Ares the plate. Another person's name or "our lord" next to the word doesn't count in other fields either.
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
