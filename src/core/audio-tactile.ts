import type { TactileFeedbackType } from "./audio.types";
import { synthesizeCrtGlassTap } from "./audio-glass-tap";
import { dispatchStudioSfx } from "./audio-studio-sfx";

let cachedSampleRate = 0;
let cachedSelectClick: AudioBuffer | null = null;

const createAppleDetentBuffer = (
  ctx: AudioContext,
  freqLow: number,
  freqHigh: number,
  durationMs = 11,
): AudioBuffer => {
  const len = Math.max(32, Math.floor(ctx.sampleRate * (durationMs / 1000)));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const totalDuration = len / ctx.sampleRate;
  const attackDuration = Math.min(0.0006, totalDuration * 0.12);
  const releaseDuration = Math.min(0.0022, totalDuration * 0.25);
  const releaseStart = totalDuration - releaseDuration;

  let peak = 0.0001;

  for (let i = 0; i < len; i++) {
    const t = i / ctx.sampleRate;
    const bodyEnv = Math.exp(-t * 420);
    const snapEnv = Math.exp(-t * 1150);

    const body = Math.sin(2 * Math.PI * freqLow * t) * 0.54 * bodyEnv;
    const harmonic = Math.sin(2 * Math.PI * (freqLow * 2.15) * t) * 0.26 * bodyEnv;
    const snap = Math.sin(2 * Math.PI * freqHigh * t) * 0.24 * snapEnv;

    let sample = body + harmonic + snap;

    if (t < attackDuration) {
      sample *= Math.sin((t / attackDuration) * (Math.PI * 0.5));
    } else if (t > releaseStart) {
      sample *= Math.cos(((t - releaseStart) / releaseDuration) * (Math.PI * 0.5));
    }

    data[i] = sample;
    const abs = Math.abs(sample);
    if (abs > peak) peak = abs;
  }

  const normalizeScale = 0.85 / peak;
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
    cachedSelectClick = createAppleDetentBuffer(ctx, 310, 1420, 11);
  }
  return cachedSelectClick;
};

export const triggerHapticDetent = (durationMs = 5): void => {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(durationMs);
  }
};

export const synthesizeIosSelectionClick = (ctx: AudioContext, destination: GainNode): void => {
  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = getSelectClickBuffer(ctx);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.11, now);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(3000, now);
  filter.Q.setValueAtTime(Math.SQRT1_2, now);

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

const synthesizeCrtPowerSwitch = (
  ctx: AudioContext,
  destination: GainNode,
  turningOn: boolean,
): void => {
  synthesizeIosSelectionClick(ctx, destination);
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const subOsc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const dur = turningOn ? 0.24 : 0.19;

  osc.type = "sine";
  subOsc.type = "sine";
  filter.type = "lowpass";
  filter.Q.setValueAtTime(Math.SQRT1_2, now);

  if (turningOn) {
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(64, now + dur);
    subOsc.frequency.setValueAtTime(320, now);
    subOsc.frequency.exponentialRampToValueAtTime(1120, now + dur);
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(2200, now + dur);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.082, now + 0.016);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + dur - 0.01);
    gain.gain.linearRampToValueAtTime(0, now + dur);
  } else {
    osc.frequency.setValueAtTime(1120, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + dur);
    subOsc.frequency.setValueAtTime(135, now);
    subOsc.frequency.exponentialRampToValueAtTime(64, now + dur);
    filter.frequency.setValueAtTime(2200, now);
    filter.frequency.exponentialRampToValueAtTime(750, now + dur);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.072, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + dur - 0.01);
    gain.gain.linearRampToValueAtTime(0, now + dur);
  }

  osc.connect(filter);
  subOsc.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  osc.start(now);
  subOsc.start(now);
  osc.stop(now + dur + 0.008);
  subOsc.stop(now + dur + 0.008);
  osc.onended = () => {
    osc.disconnect();
    subOsc.disconnect();
    filter.disconnect();
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
  else if (type === "crt_glass_tap") synthesizeCrtGlassTap(ctx, destination);
  else if (type === "crt_power_on" || type === "crt_power_off") {
    synthesizeCrtPowerSwitch(ctx, destination, type === "crt_power_on");
  }
};
