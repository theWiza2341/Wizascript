// Resolves unsafeWindow vs window depending on sandboxing. Needed once
// any feature (e.g. true-hub-bridge) requires a GM_* grant, which forces
// the whole bundle into a sandboxed context.
