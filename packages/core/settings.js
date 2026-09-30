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
//
// UnderScript creates a category's box (title and all) BEFORE checking
// whether each setting in it is hidden, and a tab whose content isn't
// empty is kept. So a category of hidden settings would leave an empty
// titled box - and keep an otherwise-empty tab alive. The category is
// therefore passed as an object whose text is the real name only while
// the setting is visible, and UnderScript's own "no category" name
// ('N/A') otherwise; UnderScript already removes that bucket when it's
// empty. (UnderScript's own categories are text-converting objects too
// - its Translation class - so this is a supported shape.)
export function createFeatureSettings(plugin, featureName, { tab, visible, categories = false } = {}) {
  const settingsApi = tab ? plugin.settings().page(tab) : plugin.settings();
  const registered = {};

  function add(key, config) {
    // `page` is always overridden by the plugin settings API anyway.
    const { category, page, hidden, ...rest } = config;
    const isHidden = () => (visible ? !visible() : false) || resolve(hidden) === true;
    const dynamicCategory = categories && category
      ? { toString: () => (isHidden() ? "N/A" : String(category)), valueOf: () => (isHidden() ? "N/A" : String(category)) }
      : null;
    const setting = settingsApi.add({
      ...rest,
      ...(dynamicCategory ? { category: dynamicCategory } : {}),
      key: `${featureName}.${key}`,
      hidden: isHidden
    });
    registered[key] = setting;
    return setting;
  }

  function value(key) {
    return registered[key].value();
  }

  return { add, value };
}
