interface TickCache {
  readonly sampleRate: number;
  readonly tickA: AudioBuffer;
  readonly tickB: AudioBuffer;
  readonly selectClick: AudioBuffer;
}

let tickParity = false;
let cache: TickCache | null = null;

const createAppleDetentBuffer = (
  ctx: AudioContext,
  freqLow: number,
  freqHigh: number,
  durationMs = 2.8,
): AudioBuffer => {
  const len = Math.max(16, Math.floor(ctx.sampleRate * (durationMs / 1000)));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const totalDuration = len / ctx.sampleRate;
  const attackDuration = Math.min(0.00035, totalDuration * 0.15);
  const releaseDuration = Math.min(0.0005, totalDuration * 0.2);
  const releaseStart = totalDuration - releaseDuration;

  let peak = 0.0001;

  for (let i = 0; i < len; i++) {
    const t = i / ctx.sampleRate;
    const bodyEnv = Math.exp(-t * 1600);
    const snapEnv = Math.exp(-t * 3600);
    const microEnv = Math.exp(-t * 5200);

    const body = Math.sin(2 * Math.PI * freqLow * t) * 0.48 * bodyEnv;
    const harmonic = Math.sin(2 * Math.PI * (freqLow * 2.1) * t) * 0.18 * bodyEnv;
    const snap = Math.sin(2 * Math.PI * freqHigh * t) * 0.28 * snapEnv;
    const texture = (Math.random() * 2 - 1) * 0.04 * microEnv;

    let sample = body + harmonic + snap + texture;

    if (t < attackDuration) {
      sample *= Math.sin((t / attackDuration) * (Math.PI * 0.5));
    } else if (t > releaseStart) {
      sample *= Math.cos(((t - releaseStart) / releaseDuration) * (Math.PI * 0.5));
    }

    data[i] = sample;
    const abs = Math.abs(sample);
    if (abs > peak) peak = abs;
  }

  for (let i = 1; i < len - 1; i++) {
    const prev = data[i - 1] ?? 0;
    const curr = data[i] ?? 0;
    const next = data[i + 1] ?? 0;
    data[i] = (prev + 2 * curr + next) * 0.25;
  }

  const normalizeScale = 0.36 / (peak || 1);
  for (let i = 0; i < len; i++) {
    const current = data[i];
    if (current !== undefined) {
      data[i] = current * normalizeScale;
    }
  }

  data[0] = 0;
  data[len - 1] = 0;

  return buffer;
};

const getTickCache = (ctx: AudioContext): TickCache => {
  if (cache && cache.sampleRate === ctx.sampleRate) return cache;
  cache = {
    sampleRate: ctx.sampleRate,
    tickA: createAppleDetentBuffer(ctx, 360, 1260, 2.8),
    tickB: createAppleDetentBuffer(ctx, 335, 1180, 2.6),
    selectClick: createAppleDetentBuffer(ctx, 260, 1080, 4.6),
  };
  return cache;
};

export const triggerHapticDetent = (durationMs = 5): void => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(durationMs);
    } catch {}
  }
};

export const synthesizeIosWheelTick = (
  ctx: AudioContext,
  destination: GainNode,
  velocitySlotsPerSec = 0,
): void => {
  const c = getTickCache(ctx);
  tickParity = !tickParity;
  const buffer = tickParity ? c.tickA : c.tickB;

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const speed = Math.min(Math.abs(velocitySlotsPerSec), 10);
  const speedNorm = speed / 10;
  const targetGain = 0.028 * (1.0 - speedNorm * 0.38);

  src.playbackRate.setValueAtTime(1.0 + speedNorm * 0.15, ctx.currentTime);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(targetGain, ctx.currentTime);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(3200 - speedNorm * 800, ctx.currentTime);
  filter.Q.setValueAtTime(Math.SQRT1_2, ctx.currentTime);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  src.start();
  src.onended = () => {
    try {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    } catch {}
  };
};

export const synthesizeIosSelectionClick = (ctx: AudioContext, destination: GainNode): void => {
  const c = getTickCache(ctx);
  const src = ctx.createBufferSource();
  src.buffer = c.selectClick;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.055, ctx.currentTime);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2800, ctx.currentTime);
  filter.Q.setValueAtTime(Math.SQRT1_2, ctx.currentTime);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  src.start();
  src.onended = () => {
    try {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    } catch {}
  };
};

export const synthesizeJellyPop = (ctx: AudioContext, destination: GainNode): void => {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(320, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.09, now + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(destination);

  osc.start(now);
  osc.stop(now + 0.085);
  osc.onended = () => {
    try {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    } catch {}
  };
};
