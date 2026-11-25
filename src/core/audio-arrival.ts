import type { GlassHarmonicSpec } from "./audio.types";

const ARRIVAL_HARMONICS: readonly GlassHarmonicSpec[] = [
  { ratio: 1.0, gainRatio: 1.0, decayDuration: 2.2 },
  { ratio: 1.25, gainRatio: 0.45, decayDuration: 1.8 },
  { ratio: 1.5, gainRatio: 0.35, decayDuration: 1.5 },
  { ratio: 2.0, gainRatio: 0.22, decayDuration: 1.1 },
  { ratio: 2.75, gainRatio: 0.12, decayDuration: 0.7 },
];

export const synthesizeProjectArrival = (
  ctx: AudioContext,
  destination: GainNode,
  fundamental = 329.63,
): void => {
  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(4200, now);
  filter.frequency.exponentialRampToValueAtTime(1100, now + 1.8);
  filter.Q.setValueAtTime(Math.SQRT1_2, now);

  masterGain.gain.setValueAtTime(1, now);
  masterGain.gain.setValueAtTime(1, now + 2.15);
  masterGain.gain.linearRampToValueAtTime(0, now + 2.24);

  filter.connect(masterGain);
  masterGain.connect(destination);

  let rootOsc: OscillatorNode | null = null;
  const nodesToClean: Array<OscillatorNode | GainNode> = [];

  for (const { ratio, gainRatio, decayDuration } of ARRIVAL_HARMONICS) {
    const osc = ctx.createOscillator();
    const modeGain = ctx.createGain();
    const freq = fundamental * ratio;

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * 1.012, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.04);

    modeGain.gain.setValueAtTime(0, now);
    modeGain.gain.linearRampToValueAtTime(0.105 * gainRatio, now + 0.018);
    modeGain.gain.exponentialRampToValueAtTime(0.0005, now + decayDuration - 0.02);
    modeGain.gain.linearRampToValueAtTime(0, now + decayDuration);

    osc.connect(modeGain);
    modeGain.connect(filter);

    osc.start(now);
    osc.stop(now + decayDuration + 0.06);

    nodesToClean.push(osc, modeGain);
    if (ratio === 1.0) rootOsc = osc;
  }

  if (rootOsc) {
    rootOsc.onended = () => {
      for (const node of nodesToClean) {
        node.disconnect();
      }
      masterGain.disconnect();
      filter.disconnect();
    };
  }
};
