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
  filter.frequency.setValueAtTime(4800, now);
  filter.frequency.exponentialRampToValueAtTime(1200, now + 1.8);
  filter.Q.setValueAtTime(1.2, now);

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

    modeGain.gain.setValueAtTime(0.0001, now);
    modeGain.gain.linearRampToValueAtTime(0.075 * gainRatio, now + 0.015);
    modeGain.gain.exponentialRampToValueAtTime(0.0001, now + decayDuration);

    osc.connect(modeGain);
    modeGain.connect(filter);

    osc.start(now);
    osc.stop(now + decayDuration + 0.05);

    nodesToClean.push(osc, modeGain);
    if (ratio === 1.0) rootOsc = osc;
  }

  if (rootOsc) {
    rootOsc.onended = () => {
      for (const node of nodesToClean) {
        try {
          node.disconnect();
        } catch {}
      }
      masterGain.disconnect();
      filter.disconnect();
    };
  }
};
