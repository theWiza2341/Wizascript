# Changelog

All notable changes to Wizascript are recorded here, newest first. The Changelog button in Wizascript's settings shows this file.

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
- **Controller support:** with Controller Support on, Primary + Touchpad opens it and the d-pad moves around the whole window. ✕ picks a card up and puts it down, △ sends it straight to a tier, □ jumps between the tiers and the item panel, and ○ cancels. All of these can be changed in the Controller Support tab.
- Its own settings tab: card size, window opacity, names on tiles, preview delay, whether ranked items are greyed out or hidden in the panel, dragging from Crafting/Decks, and turning it off during your own matches.

### Fixes
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
