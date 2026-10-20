import type { AmbientTextureHandle } from "./audio.types";
import { playGenerativeChime } from "./audio-chime";

export const startOrganicDrone = (
  ctx: AudioContext,
  destination: GainNode,
): AmbientTextureHandle => {
  const now = ctx.currentTime;
  const droneGain = ctx.createGain();
  droneGain.gain.setValueAtTime(0.0001, now);
  droneGain.gain.exponentialRampToValueAtTime(0.042, now + 3.5);
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

  const auraOsc1 = ctx.createOscillator();
  const auraOsc2 = ctx.createOscillator();
  for (const osc of [auraOsc1, auraOsc2]) osc.type = "sine";
  auraOsc1.frequency.setValueAtTime(329.63, now);
  auraOsc2.frequency.setValueAtTime(370.0, now);

  const auraGain = ctx.createGain();
  auraGain.gain.setValueAtTime(0.0001, now);
  auraOsc1.connect(auraGain);
  auraOsc2.connect(auraGain);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(240, now);
  filter.Q.setValueAtTime(0.5, now);

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
  auraGain.connect(filter);
  filter.connect(panner);
  panner.connect(droneGain);

  for (const src of [oscRoot, oscRootDetune, oscFifth, oscNinth, auraOsc1, auraOsc2, panLfo]) {
    src.start(now);
  }

  let chimeTimerId: number | undefined;
  const scheduleNextChime = (delayMs: number) => {
    chimeTimerId = window.setTimeout(() => {
      playGenerativeChime(ctx, destination);
      scheduleNextChime(9000 + Math.random() * 7000);
    }, delayMs);
  };
  scheduleNextChime(3500);

  let decayTimerId: number | undefined;
  const triggerProximityAura = (intensity = 1.0): void => {
    if (ctx.state !== "running") return;
    const t = ctx.currentTime;
    const clamped = Math.max(0, Math.min(1.0, intensity));
    const targetAuraGain = 0.0001 + clamped * 0.045;
    const targetFreq = 240 + clamped * 220;

    auraGain.gain.setTargetAtTime(targetAuraGain, t, 0.08);
    filter.frequency.setTargetAtTime(targetFreq, t, 0.1);

    if (decayTimerId !== undefined) window.clearTimeout(decayTimerId);
    decayTimerId = window.setTimeout(() => {
      if (ctx.state === "running") {
        const curT = ctx.currentTime;
        auraGain.gain.setTargetAtTime(0.0001, curT, 0.6);
        filter.frequency.setTargetAtTime(240, curT, 0.6);
      }
    }, 450);
  };

  const stop = () => {
    if (chimeTimerId !== undefined) window.clearTimeout(chimeTimerId);
    if (decayTimerId !== undefined) window.clearTimeout(decayTimerId);

    const stopTime = ctx.currentTime + 0.15;
    droneGain.gain.cancelScheduledValues(ctx.currentTime);
    droneGain.gain.setValueAtTime(droneGain.gain.value, ctx.currentTime);
    droneGain.gain.linearRampToValueAtTime(0.0001, stopTime);

    window.setTimeout(() => {
      try {
        for (const node of [
          oscRoot,
          oscRootDetune,
          oscFifth,
          oscNinth,
          auraOsc1,
          auraOsc2,
          panLfo,
        ]) {
          node.stop();
          node.disconnect();
        }
        rootGain.disconnect();
        detuneGain.disconnect();
        fifthGain.disconnect();
        ninthGain.disconnect();
        auraGain.disconnect();
        filter.disconnect();
        panner.disconnect();
        panGain.disconnect();
        droneGain.disconnect();
      } catch {}
    }, 180);
  };

  return { gainNode: droneGain, triggerProximityAura, stop };
};
