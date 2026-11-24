import type { TactileFeedbackType } from "./audio.types";

let cachedZapRate = 0;
let cachedZapBuffer: AudioBuffer | null = null;
let lastHoverSoundMs = 0;

const HOVER_COOLDOWN_MS = 110;

const getTvZapBuffer = (ctx: AudioContext): AudioBuffer => {
  if (!cachedZapBuffer || cachedZapRate !== ctx.sampleRate) {
    cachedZapRate = ctx.sampleRate;
    const len = Math.max(64, Math.floor(ctx.sampleRate * 0.14));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      const t = i / len;
      const env = Math.sin(Math.min(1, t * 8) * Math.PI * 0.5) * (1 - t) * (1 - t);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    cachedZapBuffer = buf;
  }
  return cachedZapBuffer;
};

const synthesizeHoverBlip = (ctx: AudioContext, destination: GainNode, isButton: boolean): void => {
  const nowMs = performance.now();
  if (nowMs - lastHoverSoundMs < HOVER_COOLDOWN_MS) return;
  lastHoverSoundMs = nowMs;

  const now = ctx.currentTime;
  const dur = isButton ? 0.022 : 0.036;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = isButton ? "triangle" : "sine";
  osc.frequency.setValueAtTime(isButton ? 1420 : 720, now);
  osc.frequency.exponentialRampToValueAtTime(isButton ? 1120 : 840, now + dur);

  filter.type = isButton ? "bandpass" : "lowpass";
  filter.frequency.setValueAtTime(isButton ? 1850 : 2200, now);
  filter.Q.setValueAtTime(isButton ? 1.4 : Math.SQRT1_2, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(isButton ? 0.015 : 0.018, now + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  osc.start(now);
  osc.stop(now + dur + 0.006);
  osc.onended = () => {
    osc.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
};

const synthesizeTvChannelZap = (ctx: AudioContext, destination: GainNode): void => {
  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = getTvZapBuffer(ctx);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(3400, now);
  filter.frequency.exponentialRampToValueAtTime(1450, now + 0.13);
  filter.Q.setValueAtTime(1.5, now);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.042, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

  const relay = ctx.createOscillator();
  relay.type = "triangle";
  relay.frequency.setValueAtTime(620, now);
  relay.frequency.exponentialRampToValueAtTime(180, now + 0.016);

  const relayGain = ctx.createGain();
  relayGain.gain.setValueAtTime(0.0001, now);
  relayGain.gain.linearRampToValueAtTime(0.036, now + 0.002);
  relayGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

  src.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(destination);
  relay.connect(relayGain);
  relayGain.connect(destination);

  src.start(now);
  relay.start(now);
  relay.stop(now + 0.022);
  src.onended = () => {
    src.disconnect();
    filter.disconnect();
    noiseGain.disconnect();
    relay.disconnect();
    relayGain.disconnect();
  };
};

const synthesizeDvdCornerChime = (ctx: AudioContext, destination: GainNode): void => {
  const now = ctx.currentTime;
  const notes = [1318.51, 1975.53];
  for (let i = 0; i < notes.length; i += 1) {
    const start = now + i * 0.068;
    const dur = 0.42;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(notes[i] ?? 1318.51, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(i === 0 ? 0.028 : 0.032, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(start);
    osc.stop(start + dur + 0.01);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
};

export const dispatchStudioSfx = (
  ctx: AudioContext,
  destination: GainNode,
  type: TactileFeedbackType,
): boolean => {
  if (type === "hover_hotspot" || type === "hover_button") {
    synthesizeHoverBlip(ctx, destination, type === "hover_button");
    return true;
  }
  if (type === "tv_zap") {
    synthesizeTvChannelZap(ctx, destination);
    return true;
  }
  if (type === "dvd_corner") {
    synthesizeDvdCornerChime(ctx, destination);
    return true;
  }
  return false;
};
