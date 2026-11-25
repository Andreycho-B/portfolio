const WHEEL_TICK_PEAK = 0.072;
const WHEEL_TICK_DURATION_SEC = 0.016;
const WHEEL_TICK_ATTACK_SEC = 0.0007;
const WHEEL_TICK_RELEASE_SEC = 0.0022;
const WHEEL_TICK_BODY_HZ = 620;
const WHEEL_TICK_OVERTONE_HZ = 1360;
const WHEEL_TICK_LOWPASS_HZ = 2800;

interface WheelTickCache {
  readonly sampleRate: number;
  readonly tick: AudioBuffer;
}

let wheelTickCache: WheelTickCache | null = null;

const createWheelTickBuffer = (ctx: AudioContext): AudioBuffer => {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(32, Math.floor(sampleRate * WHEEL_TICK_DURATION_SEC));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  const totalSec = length / sampleRate;
  const releaseStart = totalSec - WHEEL_TICK_RELEASE_SEC;

  let peak = 0.0001;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const attack =
      t < WHEEL_TICK_ATTACK_SEC ? Math.sin((t / WHEEL_TICK_ATTACK_SEC) * Math.PI * 0.5) : 1;
    const release =
      t > releaseStart
        ? Math.cos(((t - releaseStart) / WHEEL_TICK_RELEASE_SEC) * Math.PI * 0.5)
        : 1;
    const body = Math.sin(2 * Math.PI * WHEEL_TICK_BODY_HZ * t) * Math.exp(-t / 0.0032);
    const overtone = Math.sin(2 * Math.PI * WHEEL_TICK_OVERTONE_HZ * t) * Math.exp(-t / 0.0014);
    const sample = (body * 0.68 + overtone * 0.32) * attack * release;
    data[i] = sample;
    const abs = Math.abs(sample);
    if (abs > peak) peak = abs;
  }

  const normalizeScale = WHEEL_TICK_PEAK / peak;
  for (let i = 0; i < length; i++) {
    const current = data[i];
    if (current !== undefined) data[i] = current * normalizeScale;
  }

  data[0] = 0;
  data[length - 1] = 0;
  return buffer;
};

const getWheelTickCache = (ctx: AudioContext): WheelTickCache => {
  if (wheelTickCache && wheelTickCache.sampleRate === ctx.sampleRate) return wheelTickCache;
  wheelTickCache = {
    sampleRate: ctx.sampleRate,
    tick: createWheelTickBuffer(ctx),
  };
  return wheelTickCache;
};

export const synthesizeWheelTick = (
  ctx: AudioContext,
  destination: GainNode,
  velocitySlotsPerSec = 0,
): void => {
  const now = ctx.currentTime;
  const cache = getWheelTickCache(ctx);
  const src = ctx.createBufferSource();
  src.buffer = cache.tick;

  const speed = Math.min(Math.abs(velocitySlotsPerSec), 10);
  const speedNorm = speed / 10;
  const rateJitter = (Math.random() * 2 - 1) * 0.02;
  src.playbackRate.setValueAtTime(1 + speedNorm * 0.1 + rateJitter, now);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(WHEEL_TICK_LOWPASS_HZ, now);
  filter.Q.setValueAtTime(Math.SQRT1_2, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(1 - speedNorm * 0.32, now);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  src.start(now);
  src.onended = () => {
    src.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
};
