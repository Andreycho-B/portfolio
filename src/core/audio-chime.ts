const CHIME_PAIR_MID_THIRD = [432, 540] as const;
const CHIME_PAIR_LOW_FIFTH = [216, 324] as const;
const CHIME_PAIR_LOW_SIXTH = [270, 432] as const;
const CHIME_PAIR_MID_SIXTH = [324, 528] as const;
const CHIME_PAIR_HIGH_FIFTH = [432, 648] as const;
const RELAXING_PAIRS = [
  CHIME_PAIR_MID_THIRD,
  CHIME_PAIR_LOW_FIFTH,
  CHIME_PAIR_LOW_SIXTH,
  CHIME_PAIR_MID_SIXTH,
  CHIME_PAIR_HIGH_FIFTH,
];

export const playGenerativeChime = (ctx: AudioContext, destination: GainNode): void => {
  if (ctx.state !== "running") return;
  const now = ctx.currentTime;
  const pair = RELAXING_PAIRS[Math.floor(Math.random() * RELAXING_PAIRS.length)] ?? [432, 528];
  const pan = (Math.random() * 2 - 1) * 0.35;

  const chimeGain = ctx.createGain();
  chimeGain.gain.setValueAtTime(0.0001, now);
  // Campanadas aterciopeladas con 250ms de ataque suave y presencia cristalina
  chimeGain.gain.linearRampToValueAtTime(0.04, now + 0.25);
  chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 4.2);

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  for (const o of [osc1, osc2]) o.type = "sine";
  osc1.frequency.setValueAtTime(pair[0], now);
  osc2.frequency.setValueAtTime(pair[1], now + 0.08);

  const panner = ctx.createStereoPanner();
  panner.pan.setValueAtTime(pan, now);
  osc1.connect(chimeGain);
  osc2.connect(chimeGain);
  chimeGain.connect(panner);
  panner.connect(destination);

  osc1.start(now);
  osc2.start(now + 0.08);
  osc1.stop(now + 4.3);
  osc2.stop(now + 4.3);
  osc1.onended = () => {
    chimeGain.disconnect();
    panner.disconnect();
  };
};
