# Changelog

All notable changes to Wizascript are recorded here, newest first. The Changelog button in Wizascript's settings shows this file.

## 1.6.1

### Fixes
- **UnderScript 0.65 support:** UnderScript now pages plugin tabs with its own ◀ ▶ arrows, so Wizascript no longer adds a second set on top. The first tab is still called **General**. On older UnderScript versions, Wizascript's own arrows are used as before.
- **Controller Support:** L1/R1 and the d-pad work with UnderScript 0.65's tab arrows too.
- **Cosmetic Wishlist:** Common avatars can no longer be pinned, since everyone already has them (free emotes were already blocked).
- **Cosmetic Wishlist:** things you already own can't be pinned either. Right-clicking one shows **Already Owned** instead of Add to Wishlist. Wizascript knows you own something once the Cosmetics Shop has shown it as owned, and always knows your own avatar and profile skin in your matches.
- Wizascript's pop-up buttons use UnderScript 0.65's new button format, and still work on older versions.

## 1.6.0

### New: Tier List Maker
Make your own tier lists right inside Undercards, using the game's current cards, so they never go out of date. Turn it on in the **Plugins** list.
- Press **Primary + L** (Ctrl+L by default) on any page, even during matches, to show or hide the window. Move it by its title bar, resize it from any edge, or fill the screen with **□**.
- Drag cards, souls, artifacts and your own text labels into tiers. Find cards with the same rarity, type and set icons as the Crafting page, or by name.
- On Crafting and Decks, you can drag a card straight from the page into your list.
- With **Card Tags** on, the card search also finds your tags. Type "wincon" to see every card you've tagged Wincon.
- Rename, recolour, reorder, add or delete tiers. Undo with **↶**.
- Keep as many lists as you like with **Lists ▾**, and swap them with friends using **Share…** and **Import…** codes.
- Rest the mouse on a card to see it in full.
- **Controller support:** with Controller Support on, Primary + Touchpad opens it and the d-pad moves around the whole window. ✕ picks a card up and puts it down, △ sends it straight to a tier, □ jumps between the tiers and the item panel, and ○ cancels (including in its menus, like the Lists menu). Primary + □ fills the screen and back. The window can be moved and resized with the controller cursor too. All of these can be changed in the Controller Support tab.
- Its own settings tab: card size, window opacity, names on tiles, preview delay, whether ranked items are greyed out or hidden in the panel, dragging from Crafting/Decks, and turning it off during your own matches.

### New: Cosmetic Wishlist
Pin the avatars, emotes and profile skins you want, and Wizascript tells you when the Cosmetics Shop has them. Turn it on in the **Miscellaneous** list.
- **Right-click** an avatar, emote or profile skin (in chat, in matches, or in the Cosmetics Shop) and choose **Add to Wishlist**. Right-click it again to remove it. With Controller Support on, point the cursor at it and press △, then ✕.
- When something you pinned is in the shop, a message pops up with its price (and any sale) and a **Take me there!** button that opens the shop with that item highlighted. Pinned items are outlined with a ★ in the shop.
- The shop is checked once after each daily and weekly refresh, in the background, never during a match. You can change how often, or check only when you visit the shop yourself.
- Things you buy leave your wishlist by themselves. Free cosmetics can't be pinned, since everyone already has them.
- Its own tab lists everything you've pinned, with when it was last in the shop, a **×** to remove each one, and **Check Shop Now**.

### New: Card History
See how any card or artifact used to look. Turn it on in the **Miscellaneous** list.
- On **Crafting** or **Decks**, **middle-click** a card to see every earlier version of it, drawn as real cards: old cost, stats, rarity, text, tribes and powers, with the version number in the corner. Today's card is last.
- On **Artifacts**, middle-click an artifact to see its versions as a list, with rarity and text.
- A **\*** marks anything that isn't certain or has a note. Hover the version number to read it.
- The histories come from the Undercards wikis, the official patch notes and feildmaster's Card-Tracker, and update by themselves after each patch, with no Wizascript update needed.
- Something look wrong? **Right-click** that version and choose **Report as Bugged/Inaccurate** (⚑). **My Reports** in the history window has a **Send** button that opens the chat with your report typed in: just press Enter. Versions several players have reported show a **⚠**.
- **Controller:** point the cursor at a card and press **Primary + ✕** (the new **Middle Click** binding in the Controller Support tab) to open its history. **△** on a version reports it.

### New: Report a Bug
**Report a Bug** in Wizascript's General tab opens the chat with a bug report started. Describe the problem and press Enter. Reports are collected automatically, so there's nothing else to do.

### Fixes
- Controller Support: the default Concede button ("−") no longer briefly opens UnderScript's menu outside a match.
- Controller Support: double-tapping the Channel Guide button no longer opens Wizascript Settings (only double-tapping Primary does).
- Controller Support: holding Controller Primary no longer also triggers an In-Game Input on the same button. Combos and In-Game Inputs can now share a button (like Toggle Tier List on Primary + Touchpad, and End Turn on Touchpad).
- The Notepad and Card Tracker's trackers can no longer be dragged off the screen, where their close button couldn't be reached. Ones already off-screen come back into view, and they stay in view if you make the browser window smaller.

## 1.5.0

Wizascript is now listed in UnderScript's plugin directory, so this update is all about making it easy to understand without a readme.

### Settings overhaul
- New **General** tab (the first tab in Wizascript's settings) with a **Plugins** list and a **Miscellaneous** list. Every feature now has its own on/off switch, with a short description when you hover it.
- Each enabled plugin gets its **own settings tab**. Plugins you haven't turned on don't show any settings at all.
- **Keybinds** only appear once you enable a plugin that uses them, and only list the shortcuts for plugins you actually have on, in a section per plugin.
- **Controller Support** has its own tab for controller bindings, split into Setup, General, a section per plugin, and In-Game Inputs, and likewise only lists actions for plugins you have on.
- Notepad and Card Tags are listed under Miscellaneous; Controller Support is now listed with the other plugins.
- Tab names are never cut off. When there are more tabs than fit, they're split into pages, and **◀ ▶ arrows** at the right end of the tab row flip between them.
- New **Changelog** button (you're reading it), and a one-time popup after each update.

### New
- **How-to guides**: every plugin now explains itself: which pages it works on, what it does, and its inputs (like right-clicking cards for Card Tags). Find it at the bottom of the plugin's settings tab, or click the **?** next to any plugin in the Plugins / Miscellaneous lists, even before turning it on. Keyboard shortcuts are shown with your current keys.
- **Back up & restore settings**: save all your Wizascript settings and data (toggles, keybinds, controller bindings, Card Tracker presets, Card Tags, Notepad) as one code or file from the General tab, and restore it on another browser or after reinstalling.
- **Share Card Tags**: in Manage Tags, share some or all of your tags (with the cards they're on) as a code, or import a friend's. Imported tags merge into yours by name and never remove anything.
- **Keybind warnings**: the Keybinds tab warns when a shortcut clashes with another shortcut, with your Primary key, or with UnderScript's Space-to-end-turn hotkey. The Controller Support tab does the same for controller bindings: two actions on one button, an In-Game Input on a combo's button or on a button that already clicks/goes back/navigates, and Controller Primary or the Channel Guide on a button they'd block.
- **Controller: L1/R1 switch tabs in Settings**: sidebar categories, or the open plugin's own tabs.
- Added Logo to main settings tab.

### Changes
- **Deck Tracker is now called Card Tracker**, to better describe what it does. Your trackers, presets and settings carry over.
- New installs start with every plugin switched off. If you were already using Wizascript, the plugins you had on stay on.
- Notepad has a new **Open Notepad on Page Load** setting, shown right under Notepad once it's enabled. The Toggle Notepad shortcut now opens/closes the notepad for the current page without switching the plugin off.
- UC TV's filter settings are disabled (greyed out) while match filtering is turned off.
- UC TV no longer prints its settings to the browser console on every page load unless debug logging is on.
- The separate "Enable debug logging" options on Patch Maker, True Hub Bridge, Card Tracker and UC TV are now one **Debug logging** option at the bottom of the General tab. If you had any of them on, it stays on.

### Fixes
- Controller Support: the d-pad works in the settings' **Plugins** section again (UnderScript 0.64 changed how plugin settings are laid out). A plugin's tabs are now one row you move along with left/right, including the ◀ ▶ arrows. Moving up from a setting returns to the tab you're on.
- Controller Support: binding ✕ or the d-pad now works when you clicked the binding box with the mouse or cursor (before, the press moved the settings sidebar instead of being recorded).
