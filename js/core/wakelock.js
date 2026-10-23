// Keep the screen on only while something needs it (a practice, the breathing circle).
// Each user passes its own reason, so one finishing never switches off another.
let sentinel = null;
const reasons = new Set();

async function request() {
  if (!('wakeLock' in navigator) || !reasons.size || document.hidden || sentinel) return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener?.('release', () => { sentinel = null; });
    if (!reasons.size) { sentinel.release().catch(() => {}); sentinel = null; }
  } catch { sentinel = null; }
}

document.addEventListener('visibilitychange', () => { if (!document.hidden && reasons.size && !sentinel) request(); });

/** keepAwake('breath', true) … keepAwake('breath', false) */
export function keepAwake(reason, on = true) {
  if (on) reasons.add(reason); else reasons.delete(reason);
  if (reasons.size) request();
  else if (sentinel) { sentinel.release().catch(() => {}); sentinel = null; }
}
export const wakeLockSupported = () => 'wakeLock' in navigator;
