import type { TactileFeedbackType } from "./audio.types";

let cachedZapRate = 0;
let cachedZapBuffer: AudioBuffer | null = null;
let lastHoverSoundMs = 0;

const HOVER_COOLDOWN_MS = 105;

const getTvZapBuffer = (ctx: AudioContext): AudioBuffer => {
  if (!cachedZapBuffer || cachedZapRate !== ctx.sampleRate) {
    cachedZapRate = ctx.sampleRate;
    const len = Math.max(64, Math.floor(ctx.sampleRate * 0.12));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let smooth1 = 0;
    let smooth2 = 0;
    let peak = 0.0001;
    for (let i = 0; i < len; i += 1) {
      const t = i / (len - 1);
      const raw = Math.random() * 2 - 1;
      smooth1 += 0.16 * (raw - smooth1);
      smooth2 += 0.16 * (smooth1 - smooth2);
      const attack = Math.sin(Math.min(1, t * 14) * Math.PI * 0.5);
      const decay = (1 - t) * (1 - t);
      const sample = smooth2 * attack * decay;
      data[i] = sample;
      const abs = Math.abs(sample);
      if (abs > peak) peak = abs;
    }
    const scale = 0.85 / peak;
    for (let i = 0; i < len; i += 1) {
      const val = data[i];
      if (val !== undefined) data[i] = val * scale;
    }
    data[0] = 0;
    data[len - 1] = 0;
    cachedZapBuffer = buf;
  }
  return cachedZapBuffer;
};

const synthesizeHoverBlip = (ctx: AudioContext, destination: GainNode, isButton: boolean): void => {
  const nowMs = performance.now();
  if (nowMs - lastHoverSoundMs < HOVER_COOLDOWN_MS) return;
  lastHoverSoundMs = nowMs;

  const now = ctx.currentTime;
  const dur = isButton ? 0.036 : 0.052;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(isButton ? 960 : 620, now);
  osc.frequency.exponentialRampToValueAtTime(isButton ? 820 : 760, now + dur);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(isButton ? 2600 : 2400, now);
  filter.Q.setValueAtTime(Math.SQRT1_2, now);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(isButton ? 0.056 : 0.062, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0005, now + dur - 0.004);
  gain.gain.linearRampToValueAtTime(0, now + dur);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  osc.start(now);
  osc.stop(now + dur + 0.005);
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
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1600, now);
  filter.frequency.exponentialRampToValueAtTime(680, now + 0.11);
  filter.Q.setValueAtTime(Math.SQRT1_2, now);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0, now);
  noiseGain.gain.linearRampToValueAtTime(0.032, now + 0.006);
  noiseGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.11);
  noiseGain.gain.linearRampToValueAtTime(0, now + 0.12);

  const relay = ctx.createOscillator();
  relay.type = "sine";
  relay.frequency.setValueAtTime(260, now);
  relay.frequency.exponentialRampToValueAtTime(105, now + 0.024);

  const relayGain = ctx.createGain();
  relayGain.gain.setValueAtTime(0, now);
  relayGain.gain.linearRampToValueAtTime(0.058, now + 0.003);
  relayGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.024);
  relayGain.gain.linearRampToValueAtTime(0, now + 0.028);

  src.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(destination);
  relay.connect(relayGain);
  relayGain.connect(destination);

  src.start(now);
  relay.start(now);
  relay.stop(now + 0.032);
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
    const dur = 0.44;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(notes[i] ?? 1318.51, start);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(4200, start);
    filter.Q.setValueAtTime(Math.SQRT1_2, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(i === 0 ? 0.068 : 0.076, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0005, start + dur - 0.01);
    gain.gain.linearRampToValueAtTime(0, start + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    osc.start(start);
    osc.stop(start + dur + 0.006);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
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
