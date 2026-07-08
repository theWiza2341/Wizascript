// Owns the single GameEvent subscription for all DT animations, looks
// up the active card in the registry, and dispatches to its module.
// No-ops safely if a given DT has no animation implemented yet.
