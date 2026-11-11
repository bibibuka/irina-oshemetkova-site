// Phrase engine from the bot: pick a fresh line, never one of the last 12 of its kind.
const history = new Map();
const HISTORY = 12;

export function pick(list, kind = 'default') {
  const pool = (list || []).filter(Boolean);
  if (!pool.length) return '';
  const recent = history.get(kind) || [];
  const fresh = pool.filter((item) => !recent.includes(item));
  const source = fresh.length ? fresh : pool;
  const choice = source[Math.floor(Math.random() * source.length)];
  recent.push(choice);
  while (recent.length > Math.min(HISTORY, Math.max(0, pool.length - 1))) recent.shift();
  history.set(kind, recent);
  return choice;
}

/** Merge several pools (e.g. general + stage + night) and pick from them. */
export function pickFrom(kind, ...pools) {
  return pick(pools.flat().filter(Boolean), kind);
}

/** Deterministic shuffle copy (Fisher–Yates). */
export function shuffled(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
