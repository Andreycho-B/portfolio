export interface BeachAmbientHandle {
  readonly stop: () => void;
}

const BEACH_AMBIENT_URL = "/sounds/beach-ambient.m4a";
const LOOP_CROSSFADE_SEC = 4.0;
const BEACH_TARGET_GAIN = 0.145;
const FADE_IN_SEC = 3.2;
const HIGHPASS_HZ = 75;
const LOWPASS_HZ = 7200;

let cachedSampleRate = 0;
let cachedLoopBuffer: AudioBuffer | null = null;
let inflightLoad: Promise<AudioBuffer | null> | null = null;

const buildSeamlessLoopBuffer = (ctx: AudioContext, src: AudioBuffer): AudioBuffer => {
  const fadeSamples = Math.min(
    Math.floor(src.sampleRate * LOOP_CROSSFADE_SEC),
    Math.floor(src.length * 0.25),
  );
  if (fadeSamples < 128 || src.length <= fadeSamples * 2) return src;
  const loopLen = src.length - fadeSamples;
  const out = ctx.createBuffer(src.numberOfChannels, loopLen, src.sampleRate);
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const input = src.getChannelData(ch);
    const output = out.getChannelData(ch);
    output.set(input.subarray(0, loopLen));
    for (let i = 0; i < fadeSamples; i++) {
      const t = i / fadeSamples;
      const fadeIn = Math.sin(t * Math.PI * 0.5);
      const fadeOut = Math.cos(t * Math.PI * 0.5);
      output[i] = (input[i] ?? 0) * fadeIn + (input[loopLen + i] ?? 0) * fadeOut;
    }
  }
  return out;
};

const loadBeachLoopBuffer = async (ctx: AudioContext, url: string): Promise<AudioBuffer | null> => {
  if (cachedLoopBuffer && cachedSampleRate === ctx.sampleRate) return cachedLoopBuffer;
  if (inflightLoad) return inflightLoad;
  inflightLoad = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const raw = await res.arrayBuffer();
      const decoded = await ctx.decodeAudioData(raw);
      cachedLoopBuffer = buildSeamlessLoopBuffer(ctx, decoded);
      cachedSampleRate = ctx.sampleRate;
      return cachedLoopBuffer;
    } catch (err: unknown) {
      console.warn("[AudioBeach] Ambient load skipped:", err);
      return null;
    } finally {
      inflightLoad = null;
    }
  })();
  return inflightLoad;
};

export const startBeachAmbient = (
  ctx: AudioContext,
  destination: GainNode,
  url = BEACH_AMBIENT_URL,
): BeachAmbientHandle => {
  let stopped = false;
  let source: AudioBufferSourceNode | null = null;
  let highpass: BiquadFilterNode | null = null;
  let lowpass: BiquadFilterNode | null = null;
  let gain: GainNode | null = null;

  void loadBeachLoopBuffer(ctx, url).then((buffer) => {
    if (stopped || !buffer || ctx.state === "closed") return;
    const now = ctx.currentTime;

    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(HIGHPASS_HZ, now);
    highpass.Q.setValueAtTime(Math.SQRT1_2, now);

    lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(LOWPASS_HZ, now);
    lowpass.Q.setValueAtTime(0.65, now);

    gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(BEACH_TARGET_GAIN, now + FADE_IN_SEC);

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(destination);
    source.start(now);
  });

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    if (!source || !gain || ctx.state === "closed") return;

    const now = ctx.currentTime;
    const g = gain;
    const s = source;
    const hp = highpass;
    const lp = lowpass;
    source = null;
    gain = null;
    highpass = null;
    lowpass = null;

    if (typeof g.gain.cancelAndHoldAtTime === "function") g.gain.cancelAndHoldAtTime(now);
    else {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
    }
    g.gain.linearRampToValueAtTime(0.0001, now + 0.15);

    window.setTimeout(() => {
      try {
        if (ctx.state !== "closed") s.stop();
      } catch {
        // Source may already be stopped
      }
      s.disconnect();
      hp?.disconnect();
      lp?.disconnect();
      g.disconnect();
    }, 180);
  };

  return { stop };
};
