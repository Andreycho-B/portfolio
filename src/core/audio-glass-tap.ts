export const synthesizeCrtGlassTap = (ctx: AudioContext, destination: GainNode): void => {
  const now = ctx.currentTime;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(3600, now);
  filter.Q.setValueAtTime(Math.SQRT1_2, now);

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(0.135, now + 0.0025);
  master.gain.exponentialRampToValueAtTime(0.0005, now + 0.072);
  master.gain.linearRampToValueAtTime(0, now + 0.078);

  filter.connect(master);
  master.connect(destination);

  const thump = ctx.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(320, now);
  thump.frequency.exponentialRampToValueAtTime(145, now + 0.044);

  const glassLo = ctx.createOscillator();
  glassLo.type = "sine";
  glassLo.frequency.setValueAtTime(1280, now);

  const glassHi = ctx.createOscillator();
  glassHi.type = "sine";
  glassHi.frequency.setValueAtTime(2280, now);

  const thumpGain = ctx.createGain();
  thumpGain.gain.setValueAtTime(0.62, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  const glassLoGain = ctx.createGain();
  glassLoGain.gain.setValueAtTime(0.42, now);
  glassLoGain.gain.exponentialRampToValueAtTime(0.001, now + 0.068);

  const glassHiGain = ctx.createGain();
  glassHiGain.gain.setValueAtTime(0.2, now);
  glassHiGain.gain.exponentialRampToValueAtTime(0.001, now + 0.056);

  thump.connect(thumpGain);
  glassLo.connect(glassLoGain);
  glassHi.connect(glassHiGain);
  thumpGain.connect(filter);
  glassLoGain.connect(filter);
  glassHiGain.connect(filter);

  thump.start(now);
  glassLo.start(now);
  glassHi.start(now);
  thump.stop(now + 0.084);
  glassLo.stop(now + 0.084);
  glassHi.stop(now + 0.084);

  glassLo.onended = () => {
    thump.disconnect();
    glassLo.disconnect();
    glassHi.disconnect();
    thumpGain.disconnect();
    glassLoGain.disconnect();
    glassHiGain.disconnect();
    filter.disconnect();
    master.disconnect();
  };
};
