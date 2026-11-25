import type { AmbientTextureHandle } from "./audio.types";
import { playGenerativeChime } from "./audio-chime";

const DRONE_TARGET_GAIN = 0.058;
const DRONE_FILTER_HZ = 280;

export const startOrganicDrone = (
  ctx: AudioContext,
  destination: GainNode,
): AmbientTextureHandle => {
  const now = ctx.currentTime;
  const droneGain = ctx.createGain();
  droneGain.gain.setValueAtTime(0, now);
  droneGain.gain.linearRampToValueAtTime(DRONE_TARGET_GAIN, now + 3.2);
  droneGain.connect(destination);

  const oscRoot = ctx.createOscillator();
  const oscRootDetune = ctx.createOscillator();
  const oscFifth = ctx.createOscillator();
  const oscNinth = ctx.createOscillator();
  for (const osc of [oscRoot, oscRootDetune, oscFifth, oscNinth]) osc.type = "sine";

  oscRoot.frequency.setValueAtTime(82.41, now);
  oscRootDetune.frequency.setValueAtTime(82.68, now);
  oscFifth.frequency.setValueAtTime(123.47, now);
  oscNinth.frequency.setValueAtTime(185.0, now);

  const rootGain = ctx.createGain();
  const detuneGain = ctx.createGain();
  const fifthGain = ctx.createGain();
  const ninthGain = ctx.createGain();

  rootGain.gain.setValueAtTime(0.45, now);
  detuneGain.gain.setValueAtTime(0.25, now);
  fifthGain.gain.setValueAtTime(0.28, now);
  ninthGain.gain.setValueAtTime(0.16, now);

  oscRoot.connect(rootGain);
  oscRootDetune.connect(detuneGain);
  oscFifth.connect(fifthGain);
  oscNinth.connect(ninthGain);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(DRONE_FILTER_HZ, now);
  filter.Q.setValueAtTime(Math.SQRT1_2, now);

  const panner = ctx.createStereoPanner();
  const panLfo = ctx.createOscillator();
  const panGain = ctx.createGain();
  panLfo.type = "sine";
  panLfo.frequency.setValueAtTime(0.022, now);
  panGain.gain.setValueAtTime(0.25, now);
  panLfo.connect(panGain);
  panGain.connect(panner.pan);

  rootGain.connect(filter);
  detuneGain.connect(filter);
  fifthGain.connect(filter);
  ninthGain.connect(filter);
  filter.connect(panner);
  panner.connect(droneGain);

  const sources = [oscRoot, oscRootDetune, oscFifth, oscNinth, panLfo];
  for (const src of sources) src.start(now);

  let chimeTimerId: number | undefined;
  const scheduleNextChime = (delayMs: number) => {
    chimeTimerId = window.setTimeout(() => {
      if (ctx.state === "running" && !document.hidden) playGenerativeChime(ctx, destination);
      scheduleNextChime(9000 + Math.random() * 7000);
    }, delayMs);
  };
  scheduleNextChime(3500);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (chimeTimerId !== undefined) window.clearTimeout(chimeTimerId);

    const t = ctx.currentTime;
    const g = droneGain.gain;
    if (typeof g.cancelAndHoldAtTime === "function") g.cancelAndHoldAtTime(t);
    else {
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
    }
    g.linearRampToValueAtTime(0, t + 0.15);

    window.setTimeout(() => {
      for (const node of sources) {
        try {
          if (ctx.state !== "closed") node.stop();
        } catch (err: unknown) {
          if (!(err instanceof DOMException)) throw err;
        }
        node.disconnect();
      }
      rootGain.disconnect();
      detuneGain.disconnect();
      fifthGain.disconnect();
      ninthGain.disconnect();
      filter.disconnect();
      panner.disconnect();
      panGain.disconnect();
      droneGain.disconnect();
    }, 180);
  };

  return { gainNode: droneGain, stop };
};
