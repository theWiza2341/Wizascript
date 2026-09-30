# Changelog

All notable changes to Wizascript are recorded here, newest first. The Changelog button in Wizascript's settings shows this file.

## 1.5.0

Wizascript is now listed in UnderScript's plugin directory, so this update is all about making it easy to understand without a readme.

### Settings overhaul
- New **General** tab (the first tab in Wizascript's settings) with a **Plugins** list and a **Miscellaneous** list. Every feature now has its own on/off switch, with a short description when you hover it.
- Each enabled plugin gets its **own settings tab**. Plugins you haven't turned on don't show any settings at all.
- **Keybinds** only appear once you enable a plugin that uses them, and only list the shortcuts for plugins you actually have on.
- **Controller Support** has its own tab for controller bindings, which likewise only lists actions for plugins you have on.
- Notepad and Card Tags are listed under Miscellaneous; Controller Support is now listed with the other plugins.
- Tab names are never cut off. When there are more tabs than fit, they're split into pages, and **◀ ▶ arrows** at the right end of the tab row flip between them.
- New **Changelog** button (you're reading it), and a one-time popup after each update.

### Changes
- **Deck Tracker is now called Card Tracker**, to better describe what it does. Your trackers, presets and settings carry over.
- New installs start with every plugin switched off. If you were already using Wizascript, the plugins you had on stay on.
- Notepad has a new **Open Notepad on Page Load** setting, shown right under Notepad once it's enabled. The Toggle Notepad shortcut now opens/closes the notepad for the current page without switching the plugin off.
- UC TV's filter settings are disabled (greyed out) while match filtering is turned off.
- UC TV no longer prints its settings to the browser console on every page load unless debug logging is on.

### Fixes
- Controller Support: the d-pad works in the settings' **Plugins** section again (UnderScript 0.64 changed how plugin settings are laid out). A plugin's tabs are now one row you move along with left/right, including the ◀ ▶ arrows.

## 1.4.1 and earlier

Wizascript combined several separate plugins into one download: Patch Maker, True Hub Bridge, Deck Tracker, UC TV, Notepad, Card Tags, remappable keybinds, and controller support. Detailed notes weren't kept before 1.5.0.
