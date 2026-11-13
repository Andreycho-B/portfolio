const WHEEL_TICK_PEAK = 0.112;
const WHEEL_TICK_DURATION_SEC = 0.02;
const WHEEL_TICK_CENTER_HZ = 4600;
const WHEEL_TICK_BAND_Q = 1;
const WHEEL_TICK_ATTACK_SEC = 0.00015;
const WHEEL_TICK_FAST_DECAY_SEC = 0.0004;
const WHEEL_TICK_SLOW_DECAY_SEC = 0.0018;
const WHEEL_TICK_TONE_LOW_PASS_HZ = 9000;

interface WheelTickCache {
  readonly sampleRate: number;
  readonly tick: AudioBuffer;
}

let wheelTickCache: WheelTickCache | null = null;

const createWheelTickBuffer = (ctx: AudioContext): AudioBuffer => {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(16, Math.floor(sampleRate * WHEEL_TICK_DURATION_SEC));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  const bandW0 = (2 * Math.PI * WHEEL_TICK_CENTER_HZ) / sampleRate;
  const bandAlpha = Math.sin(bandW0) / (2 * WHEEL_TICK_BAND_Q);
  const bandA0 = 1 + bandAlpha;
  const bandB0 = bandAlpha / bandA0;
  const bandB2 = -bandAlpha / bandA0;
  const bandA1 = (-2 * Math.cos(bandW0)) / bandA0;
  const bandA2 = (1 - bandAlpha) / bandA0;

  const toneW0 = (2 * Math.PI * WHEEL_TICK_TONE_LOW_PASS_HZ) / sampleRate;
  const toneAlpha = Math.sin(toneW0) / (2 * Math.SQRT1_2);
  const toneA0 = 1 + toneAlpha;
  const toneB0 = (1 - Math.cos(toneW0)) / 2 / toneA0;
  const toneB1 = (1 - Math.cos(toneW0)) / toneA0;
  const toneB2 = toneB0;
  const toneA2 = (1 - toneAlpha) / toneA0;
  const toneA1 = (-2 * Math.cos(toneW0)) / toneA0;

  let bandX1 = 0;
  let bandX2 = 0;
  let bandY1 = 0;
  let bandY2 = 0;
  let toneX1 = 0;
  let toneX2 = 0;
  let toneY1 = 0;
  let toneY2 = 0;
  let peak = 0.0001;

  for (let i = 0; i < length; i++) {
    const noise = Math.random() * 2 - 1;
    const bandPassed = bandB0 * noise + bandB2 * bandX2 - bandA1 * bandY1 - bandA2 * bandY2;
    bandX2 = bandX1;
    bandX1 = noise;
    bandY2 = bandY1;
    bandY1 = bandPassed;

    const toned =
      toneB0 * bandPassed + toneB1 * toneX1 + toneB2 * toneX2 - toneA1 * toneY1 - toneA2 * toneY2;
    toneX2 = toneX1;
    toneX1 = bandPassed;
    toneY2 = toneY1;
    toneY1 = toned;

    const elapsedSec = i / sampleRate;
    const attack = elapsedSec < WHEEL_TICK_ATTACK_SEC ? elapsedSec / WHEEL_TICK_ATTACK_SEC : 1;
    const envelope =
      0.9 * Math.exp(-elapsedSec / WHEEL_TICK_FAST_DECAY_SEC) +
      0.1 * Math.exp(-elapsedSec / WHEEL_TICK_SLOW_DECAY_SEC);
    const sample = toned * attack * envelope;
    data[i] = sample;
    const abs = Math.abs(sample);
    if (abs > peak) peak = abs;
  }

  const normalizeScale = WHEEL_TICK_PEAK / (peak || 1);
  for (let i = 0; i < length; i++) {
    const current = data[i];
    if (current !== undefined) {
      data[i] = current * normalizeScale;
    }
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
  const cache = getWheelTickCache(ctx);
  const src = ctx.createBufferSource();
  src.buffer = cache.tick;

  const speed = Math.min(Math.abs(velocitySlotsPerSec), 10);
  const speedNorm = speed / 10;
  const rateJitter = (Math.random() * 2 - 1) * 0.03;
  src.playbackRate.setValueAtTime(1 + speedNorm * 0.12 + rateJitter, ctx.currentTime);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(1 - speedNorm * 0.38, ctx.currentTime);

  src.connect(gain);
  gain.connect(destination);
  src.start();
  src.onended = () => {
    try {
      src.disconnect();
      gain.disconnect();
    } catch {}
  };
};
