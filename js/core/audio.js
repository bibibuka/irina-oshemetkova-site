// Sound is generated in the browser — no files, no requests. Off by default.
// The AudioContext is created lazily inside a tap (required on iOS).
let ctx = null;
let master = null;

export function audioSupported() { return Boolean(window.AudioContext || window.webkitAudioContext); }

/** Call synchronously inside a click/keydown handler. */
export function ensureAudio() {
  if (!audioSupported()) return null;
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    ctx = new Ctor({ latencyHint: 'playback' });
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return ctx;
}

export function audioState() { return ctx?.state || 'none'; }

/** A soft sine glide for breathing: tone(196, 247, 4) on inhale, tone(247, 196, 6) on exhale. */
export function glide(from, to, seconds, level = 0.035) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.linearRampToValueAtTime(to, t + seconds);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(level, t + Math.min(1.2, seconds / 3));
  gain.gain.linearRampToValueAtTime(0, t + seconds);
  osc.connect(gain); gain.connect(master);
  osc.start(t); osc.stop(t + seconds + 0.05);
}

/** A tiny bell for «закрой глаза» mode: two harmonics, 1.4 s decay. */
export function bell(base = 392, level = 0.05) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  [base, base * 2].forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(level / (index + 1), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    osc.connect(gain); gain.connect(master);
    osc.start(t); osc.stop(t + 1.5);
  });
}

/** Vibrate on Android if the visitor allowed it. No-op elsewhere (iOS has no API). */
export function buzz(pattern = 20) {
  try { if ('vibrate' in navigator) navigator.vibrate(pattern); } catch { /* ignore */ }
}
export const vibrationSupported = () => 'vibrate' in navigator && !/iPhone|iPad/i.test(navigator.userAgent);
