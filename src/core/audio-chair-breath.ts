import type { ChairBreathAction } from "./audio.types";

const CHAIR_BREATH_URL = "/sounds/chair-deep-breath.mp3";
const BREATH_OFFSET_SEC = 0.3;
const BREATH_PLAY_SEC = 4.65;
const BREATH_GAIN = 0.38;
const BREATH_TARGET_PEAK = 0.78;
const FADE_IN_SEC = 0.28;
const FADE_OUT_SEC = 0.52;
const HIGHPASS_HZ = 95;
const LOWPASS_HZ = 5800;

interface ActiveBreathNodes {
  readonly source: AudioBufferSourceNode;
  readonly highpass: BiquadFilterNode;
  readonly lowpass: BiquadFilterNode;
  readonly gain: GainNode;
  readonly cleanupTimer: number | null;
}

let cachedSampleRate = 0;
let cachedBuffer: AudioBuffer | null = null;
let inflightLoad: Promise<AudioBuffer | null> | null = null;
let activeNodes: ActiveBreathNodes | null = null;
let playGeneration = 0;

const sanitizeBreathBuffer = (buf: AudioBuffer): AudioBuffer => {
  let peak = 0.0001;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    let sum = 0;
    for (let i = 0; i < d.length; i++) sum += d[i] ?? 0;
    const dc = d.length > 0 ? sum / d.length : 0;
    const removeDc = Math.abs(dc) > 0.002 ? dc : 0;
    for (let i = 0; i < d.length; i++) {
      const s = (d[i] ?? 0) - removeDc;
      d[i] = s;
      const abs = Math.abs(s);
      if (abs > peak) peak = abs;
    }
  }
  const scale = Math.max(0.35, Math.min(2.0, BREATH_TARGET_PEAK / peak));
  if (Math.abs(scale - 1) > 0.04) {
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < d.length; i++) {
        const s = d[i];
        if (s !== undefined) d[i] = Math.max(-0.92, Math.min(0.92, s * scale));
      }
    }
  }
  return buf;
};

const loadChairBreathBuffer = (ctx: AudioContext): Promise<AudioBuffer | null> => {
  if (cachedBuffer && cachedSampleRate === ctx.sampleRate) return Promise.resolve(cachedBuffer);
  if (inflightLoad) return inflightLoad;
  inflightLoad = (async () => {
    try {
      const res = await fetch(CHAIR_BREATH_URL);
      if (!res.ok) return null;
      const decoded = sanitizeBreathBuffer(await ctx.decodeAudioData(await res.arrayBuffer()));
      cachedBuffer = decoded;
      cachedSampleRate = ctx.sampleRate;
      return decoded;
    } catch (err: unknown) {
      console.warn("[AudioChairBreath] Breath audio load skipped:", err);
      return null;
    } finally {
      inflightLoad = null;
    }
  })();
  return inflightLoad;
};

const releaseNodes = (nodes: ActiveBreathNodes, ctx: AudioContext | null): void => {
  if (nodes.cleanupTimer !== null) window.clearTimeout(nodes.cleanupTimer);
  try {
    if (ctx && ctx.state !== "closed") nodes.source.stop();
  } catch (err: unknown) {
    if (!(err instanceof DOMException)) throw err;
  }
  nodes.source.disconnect();
  nodes.highpass.disconnect();
  nodes.lowpass.disconnect();
  nodes.gain.disconnect();
};

const stopActiveBreath = (ctx: AudioContext | null): void => {
  playGeneration += 1;
  const nodes = activeNodes;
  if (!nodes) return;
  activeNodes = null;
  if (nodes.cleanupTimer !== null) window.clearTimeout(nodes.cleanupTimer);
  if (!ctx || ctx.state === "closed") {
    releaseNodes(nodes, null);
    return;
  }
  const now = ctx.currentTime;
  const g = nodes.gain.gain;
  if (typeof g.cancelAndHoldAtTime === "function") g.cancelAndHoldAtTime(now);
  else {
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, g.value), now);
  }
  g.linearRampToValueAtTime(0, now + 0.18);
  window.setTimeout(() => releaseNodes(nodes, ctx), 210);
};

const startBreathPlayback = (ctx: AudioContext, destination: GainNode): void => {
  stopActiveBreath(ctx);
  const gen = playGeneration;
  void loadChairBreathBuffer(ctx).then((buffer) => {
    if (gen !== playGeneration || !buffer || ctx.state === "closed") return;
    const offset = Math.min(BREATH_OFFSET_SEC, Math.max(0, buffer.duration - 0.5));
    const duration = Math.min(BREATH_PLAY_SEC, Math.max(0.4, buffer.duration - offset));
    const now = ctx.currentTime;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(HIGHPASS_HZ, now);
    highpass.Q.setValueAtTime(Math.SQRT1_2, now);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(LOWPASS_HZ, now);
    lowpass.Q.setValueAtTime(Math.SQRT1_2, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(BREATH_GAIN, now + FADE_IN_SEC);
    const fadeOutStart = now + Math.max(FADE_IN_SEC + 0.1, duration - FADE_OUT_SEC);
    gain.gain.setValueAtTime(BREATH_GAIN, fadeOutStart);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(destination);

    const cleanupTimer = window.setTimeout(
      () => {
        if (activeNodes?.source === source) activeNodes = null;
        releaseNodes(nodes, ctx);
      },
      Math.ceil((duration + 0.15) * 1000),
    );
    const nodes: ActiveBreathNodes = { source, highpass, lowpass, gain, cleanupTimer };
    activeNodes = nodes;
    source.start(now, offset, duration);
  });
};

export const dispatchChairBreath = (
  action: ChairBreathAction,
  ctx: AudioContext | null,
  destination: GainNode | null,
  muted: boolean,
): void => {
  if (action === "stop") {
    stopActiveBreath(ctx);
    return;
  }
  if (muted || !ctx || ctx.state === "closed") return;
  if (action === "preload") void loadChairBreathBuffer(ctx);
  else if (destination) startBreathPlayback(ctx, destination);
};
