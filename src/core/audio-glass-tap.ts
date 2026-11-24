let customGlassTapBuffer: AudioBuffer | null = null;

export const loadCustomCrtGlassTapSample = async (
  ctx: AudioContext,
  url: string,
): Promise<void> => {
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const raw = await res.arrayBuffer();
    customGlassTapBuffer = await ctx.decodeAudioData(raw);
  } catch (err) {
    console.warn("[AudioGlassTap] Custom sample load skipped:", err);
  }
};

export const synthesizeCrtGlassTap = (ctx: AudioContext, destination: GainNode): void => {
  if (customGlassTapBuffer) {
    const src = ctx.createBufferSource();
    src.buffer = customGlassTapBuffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    src.connect(gain);
    gain.connect(destination);
    src.start();
    src.onended = () => {
      src.disconnect();
      gain.disconnect();
    };
    return;
  }

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.linearRampToValueAtTime(0.11, now + 0.002);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
  master.connect(destination);

  const thump = ctx.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(380, now);
  thump.frequency.exponentialRampToValueAtTime(165, now + 0.042);

  const glassLo = ctx.createOscillator();
  glassLo.type = "sine";
  glassLo.frequency.setValueAtTime(1420, now);

  const glassHi = ctx.createOscillator();
  glassHi.type = "triangle";
  glassHi.frequency.setValueAtTime(2680, now);

  const thumpGain = ctx.createGain();
  thumpGain.gain.setValueAtTime(0.65, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.01, now + 0.045);

  const glassLoGain = ctx.createGain();
  glassLoGain.gain.setValueAtTime(0.45, now);
  glassLoGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

  const glassHiGain = ctx.createGain();
  glassHiGain.gain.setValueAtTime(0.24, now);
  glassHiGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

  thump.connect(thumpGain);
  glassLo.connect(glassLoGain);
  glassHi.connect(glassHiGain);
  thumpGain.connect(master);
  glassLoGain.connect(master);
  glassHiGain.connect(master);

  thump.start(now);
  glassLo.start(now);
  glassHi.start(now);
  thump.stop(now + 0.08);
  glassLo.stop(now + 0.08);
  glassHi.stop(now + 0.08);

  glassLo.onended = () => {
    thump.disconnect();
    glassLo.disconnect();
    glassHi.disconnect();
    thumpGain.disconnect();
    glassLoGain.disconnect();
    glassHiGain.disconnect();
    master.disconnect();
  };
};
