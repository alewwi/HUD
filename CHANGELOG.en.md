# Changelog

[Русская версия](CHANGELOG.md)

All notable changes to TavernOS HUD, newest first, starting from version 23.88.7.

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
