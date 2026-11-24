import type { TactileFeedbackType } from "./audio.types";
import { synthesizeCrtGlassTap } from "./audio-glass-tap";
import { dispatchStudioSfx } from "./audio-studio-sfx";

let cachedSampleRate = 0;
let cachedSelectClick: AudioBuffer | null = null;

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

const getSelectClickBuffer = (ctx: AudioContext): AudioBuffer => {
  if (!cachedSelectClick || cachedSampleRate !== ctx.sampleRate) {
    cachedSampleRate = ctx.sampleRate;
    cachedSelectClick = createAppleDetentBuffer(ctx, 260, 1080, 4.6);
  }
  return cachedSelectClick;
};

export const triggerHapticDetent = (durationMs = 5): void => {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(durationMs);
  }
};

export const synthesizeIosSelectionClick = (ctx: AudioContext, destination: GainNode): void => {
  const src = ctx.createBufferSource();
  src.buffer = getSelectClickBuffer(ctx);

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
    src.disconnect();
    filter.disconnect();
    gain.disconnect();
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
    osc.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
};

export const synthesizeCrtPowerSwitch = (
  ctx: AudioContext,
  destination: GainNode,
  turningOn: boolean,
): void => {
  synthesizeIosSelectionClick(ctx, destination);
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const subOsc = ctx.createOscillator();
  const gain = ctx.createGain();
  const dur = turningOn ? 0.2 : 0.16;

  if (turningOn) {
    osc.type = "sine";
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + dur);
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(440, now);
    subOsc.frequency.exponentialRampToValueAtTime(1760, now + dur);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.036, now + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  } else {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(3200, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + dur);
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(48, now + dur);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.035, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  }

  osc.connect(gain);
  subOsc.connect(gain);
  gain.connect(destination);
  osc.start(now);
  subOsc.start(now);
  osc.stop(now + dur + 0.01);
  subOsc.stop(now + dur + 0.01);
  osc.onended = () => {
    osc.disconnect();
    subOsc.disconnect();
    gain.disconnect();
  };
};

export const dispatchTactileSynthesis = (
  ctx: AudioContext,
  destination: GainNode,
  type: TactileFeedbackType,
): void => {
  if (dispatchStudioSfx(ctx, destination, type)) return;
  if (type === "click") synthesizeIosSelectionClick(ctx, destination);
  else if (type === "jelly_pop") synthesizeJellyPop(ctx, destination);
  else if (type === "crt_glass_tap") synthesizeCrtGlassTap(ctx, destination);
  else if (type === "crt_power_on" || type === "crt_power_off") {
    synthesizeCrtPowerSwitch(ctx, destination, type === "crt_power_on");
  }
};
