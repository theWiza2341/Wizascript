// Toggleable, prefixed console logging - supports both per-category
// flags and severity levels, since scripts in this suite have
// independently wanted both.
//
// Gating model: categories are ON by default. Calling setCategory(name,
// false) explicitly silences that one category. This is deliberate -
// each feature's "Enable debug logging" setting is meant to unlock ALL
// of that feature's debug output at once (the setting's own onChange
// wrapper is the real on/off switch); categories exist for readable
// console prefixes, not as a second opt-in gate a feature would have to
// remember to flip on for every label it uses.

export function createLogger(featureName, initialCategories = {}) {
  const enabled = { ...initialCategories };

  function tag(category) {
    return category ? `[${featureName}:${category}]` : `[${featureName}]`;
  }

  function isEnabled(category) {
    return !category || enabled[category] !== false;
  }

  return {
    setCategory(category, isEnabled) {
      enabled[category] = isEnabled;
    },
    log(category, ...args) {
      if (!isEnabled(category)) return;
      console.log(tag(category), ...args);
    },
    warn(category, ...args) {
      if (!isEnabled(category)) return;
      console.warn(tag(category), ...args);
    },
    error(category, ...args) {
      console.error(tag(category), ...args); // errors always print
    }
  };
}
