// Preferences and local saves. By default nothing leaves the page and nothing
// is written to the device. Only after the visitor explicitly turns «память» on
// are values mirrored to localStorage, and one call erases everything.
const PREFIX = 'io.v1.';
const MEMORY_FLAG = `${PREFIX}memory`;
const values = new Map();
const listeners = new Set();

function storage() {
  try { return window.localStorage; } catch { return null; }
}

function readPersisted() {
  const ls = storage();
  if (!ls) return false;
  try {
    if (ls.getItem(MEMORY_FLAG) !== 'on') return false;
    for (let i = 0; i < ls.length; i += 1) {
      const key = ls.key(i);
      if (!key || !key.startsWith(PREFIX) || key === MEMORY_FLAG) continue;
      try { values.set(key.slice(PREFIX.length), JSON.parse(ls.getItem(key))); } catch { /* skip broken value */ }
    }
    return true;
  } catch { return false; }
}

let memory = readPersisted();

function emit(key, value) {
  listeners.forEach((fn) => { try { fn(key, value); } catch (error) { console.error(error); } });
  document.dispatchEvent(new CustomEvent('store:change', { detail: { key, value } }));
}

export const store = {
  get(key, fallback = null) { return values.has(key) ? values.get(key) : fallback; },
  set(key, value) {
    if (value === undefined || value === null) values.delete(key); else values.set(key, value);
    if (memory) {
      const ls = storage();
      try {
        if (value === undefined || value === null) ls?.removeItem(PREFIX + key);
        else ls?.setItem(PREFIX + key, JSON.stringify(value));
      } catch { /* quota or privacy mode: keep in memory only */ }
    }
    emit(key, value);
  },
  /** Session-only value that is never persisted, even with memory on. */
  temp: new Map(),
  get memory() { return memory; },
  enableMemory() {
    const ls = storage();
    if (!ls) return false;
    try {
      ls.setItem(MEMORY_FLAG, 'on');
      values.forEach((value, key) => ls.setItem(PREFIX + key, JSON.stringify(value)));
      memory = true;
      emit('memory', true);
      return true;
    } catch { return false; }
  },
  /** Turn memory off and erase every trace on this device. Values stay for this visit. */
  disableMemory() {
    store.eraseDevice();
    memory = false;
    emit('memory', false);
  },
  eraseDevice() {
    const ls = storage();
    if (!ls) return;
    try {
      const keys = [];
      for (let i = 0; i < ls.length; i += 1) { const key = ls.key(i); if (key?.startsWith(PREFIX)) keys.push(key); }
      keys.forEach((key) => ls.removeItem(key));
    } catch { /* nothing to erase */ }
  },
  /** Everything currently known (for the «Что знает этот сайт» panel). */
  snapshot() { return Object.fromEntries(values); },
  forgetAll() {
    values.clear();
    store.eraseDevice();
    memory = false;
    emit('*', null);
  },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
