// Toggleable, prefixed console logging - supports both per-category
// flags and severity levels, since scripts in this suite have
// independently wanted both.

export function createLogger(featureName, initialCategories = {}) {
  const enabled = { ...initialCategories };

  function tag(category) {
    return category ? `[${featureName}:${category}]` : `[${featureName}]`;
  }

  return {
    setCategory(category, isEnabled) {
      enabled[category] = isEnabled;
    },
    log(category, ...args) {
      if (category && !enabled[category]) return;
      console.log(tag(category), ...args);
    },
    warn(category, ...args) {
      if (category && !enabled[category]) return;
      console.warn(tag(category), ...args);
    },
    error(category, ...args) {
      console.error(tag(category), ...args); // errors always print
    }
  };
}
