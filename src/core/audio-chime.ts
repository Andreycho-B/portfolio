const CHIME_PAIR_E_FIFTH = [329.63, 493.88] as const;
const CHIME_PAIR_E_SUS2 = [329.63, 369.99] as const;
const CHIME_PAIR_B_FOURTH = [246.94, 329.63] as const;
const CHIME_PAIR_FSHARP_OCTAVE = [369.99, 493.88] as const;
const CHIME_PAIR_HIGH_ETHEREAL = [493.88, 659.25] as const;
const RELAXING_PAIRS = [
  CHIME_PAIR_E_FIFTH,
  CHIME_PAIR_E_SUS2,
  CHIME_PAIR_B_FOURTH,
  CHIME_PAIR_FSHARP_OCTAVE,
  CHIME_PAIR_HIGH_ETHEREAL,
];

export const playGenerativeChime = (ctx: AudioContext, destination: GainNode): void => {
  if (ctx.state !== "running") return;
  const now = ctx.currentTime;
  const pair = RELAXING_PAIRS[Math.floor(Math.random() * RELAXING_PAIRS.length)] ?? [
    329.63, 493.88,
  ];
  const pan = (Math.random() * 2 - 1) * 0.35;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2800, now);
  filter.Q.setValueAtTime(Math.SQRT1_2, now);

  const chimeGain = ctx.createGain();
  chimeGain.gain.setValueAtTime(0, now);
  chimeGain.gain.linearRampToValueAtTime(0.062, now + 0.34);
  chimeGain.gain.exponentialRampToValueAtTime(0.0005, now + 4.75);
  chimeGain.gain.linearRampToValueAtTime(0, now + 4.86);

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  for (const o of [osc1, osc2]) o.type = "sine";
  osc1.frequency.setValueAtTime(pair[0], now);
  osc2.frequency.setValueAtTime(pair[1], now + 0.08);

  const panner = ctx.createStereoPanner();
  panner.pan.setValueAtTime(pan, now);
  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(chimeGain);
  chimeGain.connect(panner);
  panner.connect(destination);

  osc1.start(now);
  osc2.start(now + 0.08);
  osc1.stop(now + 4.92);
  osc2.stop(now + 4.92);
  let isCleaned = false;
  const cleanup = () => {
    if (isCleaned) return;
    isCleaned = true;
    osc1.disconnect();
    osc2.disconnect();
    filter.disconnect();
    chimeGain.disconnect();
    panner.disconnect();
  };
  osc1.onended = cleanup;
  osc2.onended = cleanup;
};
