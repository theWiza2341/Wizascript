// Wraps plugin.settings().add() - auto-prefixes each feature's keys and
// actually captures the returned setting object, fixing the bug where
// True Hub Bridge's original code discarded .add()'s return value and
// called a .get() method that doesn't exist on the settings API.

export function createFeatureSettings(plugin, featureName, categoryLabel) {
  const settingsApi = plugin.settings();
  const registered = {};

  function add(key, config) {
    const setting = settingsApi.add({
      ...config,
      key: `${featureName}.${key}`,
      category: config.category || categoryLabel
    });
    registered[key] = setting;
    return setting;
  }

  function value(key) {
    return registered[key].value();
  }

  return { add, value };
}
