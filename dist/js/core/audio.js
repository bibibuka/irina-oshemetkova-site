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

function noiseBuffer(type, seconds = 4) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let last = 0;
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      if (type === 'brown') {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      } else if (type === 'pink') {
        b0 = 0.99886 * b0 + white * 0.0555179; b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852; b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522; b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      } else {
        data[i] = white * 0.5;
      }
    }
    // soften the loop seam
    const fade = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < fade; i += 1) {
      const k = i / fade;
      data[i] *= k;
      data[length - 1 - i] *= k;
    }
  }
  return buffer;
}

/**
 * A continuous noise («белый», «розовый», «коричневый», «волны»).
 * const n = createNoise('brown'); n.start(0.4); n.setVolume(0.2); n.stop();
 */
export function createNoise(type = 'brown') {
  if (!ensureAudio()) return null;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = type === 'white' ? 9000 : type === 'pink' ? 6000 : 1400;
  filter.connect(gain);
  gain.connect(master);
  let source = null;
  let lfo = null;
  let volume = 0.35;
  const begin = () => {
    source = ctx.createBufferSource();
    source.buffer = noiseBuffer(type === 'waves' ? 'pink' : type);
    source.loop = true;
    source.connect(filter);
    source.start();
    if (type === 'waves') {
      // slow swell, like the sea at night
      lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 0.09;
      depth.gain.value = 900;
      filter.frequency.value = 1200;
      lfo.connect(depth);
      depth.connect(filter.frequency);
      lfo.start();
    }
  };
  return {
    type,
    start(level = volume, fadeSeconds = 2.5) {
      volume = level;
      if (!source) begin();
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(volume * 0.5, t + fadeSeconds);
    },
    setVolume(level) {
      volume = level;
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setTargetAtTime(volume * 0.5, t, 0.2);
    },
    stop(fadeSeconds = 2) {
      if (!source) return;
      const t = ctx.currentTime;
      const s = source; const l = lfo;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + fadeSeconds);
      setTimeout(() => { try { s.stop(); l?.stop(); } catch { /* already stopped */ } }, fadeSeconds * 1000 + 100);
      source = null; lfo = null;
    },
    get playing() { return Boolean(source); },
  };
}

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
