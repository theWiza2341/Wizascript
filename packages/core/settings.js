// Wraps plugin.settings().add() - auto-prefixes each feature's keys and
// actually captures the returned setting object, fixing the bug where
// True Hub Bridge's original code discarded .add()'s return value and
// called a .get() method that doesn't exist on the settings API.
//
// 1.5.0: every feature now lives on its OWN settings tab inside the
// Wizascript entry (UnderScript's plugin.settings().page(tabName)), with
// no categories inside it. Each setting is hidden unless `visible()`
// returns true - normally "is this feature's plugin enabled in the
// Plugins list". UnderScript drops a tab entirely once every setting on
// it is hidden, so a disabled plugin's tab simply isn't there.
//
// Keys are unaffected by which tab a setting is on (UnderScript prefixes
// keys with underscript.plugin.Wizascript.<key> regardless), so moving a
// setting between tabs never loses a user's saved value.
//
// Visibility is evaluated whenever UnderScript renders the settings
// screen, which happens each time the dialog is (re)opened - not live
// while it's already open.

function resolve(v) {
  return typeof v === "function" ? v() : v;
}

// `categories: true` keeps each setting's `category` (used by the
// Keybinds and Controller Support tabs, which group rows per plugin).
// Everywhere else categories are dropped - plugin tabs are flat lists.
// A category whose rows are all hidden (a disabled plugin's section) is
// removed from view by hideEmptyCategories() in setting-widgets.js.
export function createFeatureSettings(plugin, featureName, { tab, visible, categories = false } = {}) {
  const settingsApi = tab ? plugin.settings().page(tab) : plugin.settings();
  const registered = {};

  function add(key, config) {
    // `page` is always overridden by the plugin settings API anyway.
    const { category, page, hidden, ...rest } = config;
    const setting = settingsApi.add({
      ...rest,
      ...(categories && category ? { category } : {}),
      key: `${featureName}.${key}`,
      hidden: () => (visible ? !visible() : false) || resolve(hidden) === true
    });
    registered[key] = setting;
    return setting;
  }

  function value(key) {
    return registered[key].value();
  }

  return { add, value };
}
