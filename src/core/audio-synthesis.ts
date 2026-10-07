import type { AmbientTextureHandle, GlassHarmonicSpec } from "./audio.types";

const INHARMONIC_MODES: readonly GlassHarmonicSpec[] = [
  { ratio: 1.0, gainRatio: 1.0, decayDuration: 3.2 },
  { ratio: 1.222, gainRatio: 0.35, decayDuration: 2.2 },
  { ratio: 1.5, gainRatio: 0.2, decayDuration: 1.6 },
];

const P1 = [432, 528] as const,
  P2 = [216, 324] as const,
  P3 = [270, 432] as const;
const P4 = [324, 528] as const,
  P5 = [432, 648] as const;
const RELAXING_PAIRS = [P1, P2, P3, P4, P5];

const playGenerativeChime = (ctx: AudioContext, destination: GainNode): void => {
  if (ctx.state !== "running") return;
  const now = ctx.currentTime;
  const pair = RELAXING_PAIRS[Math.floor(Math.random() * RELAXING_PAIRS.length)] ?? [432, 528];
  const pan = (Math.random() * 2 - 1) * 0.35;

  const chimeGain = ctx.createGain();
  chimeGain.gain.setValueAtTime(0.0001, now);
  // Campanadas aterciopeladas con 250ms de ataque suave y presencia cristalina
  chimeGain.gain.linearRampToValueAtTime(0.052, now + 0.25);
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

export const startOrganicDrone = (
  ctx: AudioContext,
  destination: GainNode,
): AmbientTextureHandle => {
  const now = ctx.currentTime;
  const droneGain = ctx.createGain();
  droneGain.gain.setValueAtTime(0.0001, now);
  // Drone tenue y aterciopelado (reducido a 0.045 con entrada progresiva de 4s)
  droneGain.gain.exponentialRampToValueAtTime(0.045, now + 4.0);
  droneGain.connect(destination);

  const oscBase = ctx.createOscillator();
  const oscFifth = ctx.createOscillator();
  const oscThird = ctx.createOscillator();
  for (const osc of [oscBase, oscFifth, oscThird]) osc.type = "sine";

  oscBase.frequency.setValueAtTime(216.0, now);
  oscFifth.frequency.setValueAtTime(324.0, now);
  oscThird.frequency.setValueAtTime(270.0, now);

  const fifthGain = ctx.createGain();
  const thirdGain = ctx.createGain();
  fifthGain.gain.setValueAtTime(0.55, now);
  thirdGain.gain.setValueAtTime(0.35, now);
  oscFifth.connect(fifthGain);
  oscThird.connect(thirdGain);

  // Filtro Bessel subcrítico (Q=0.5, corte a 260Hz): Cero pico de resonancia nasal/zumbido
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(260, now);
  filter.Q.setValueAtTime(0.5, now);

  // LFO de Coherencia Cardiovascular HRV: respiración pausada y sutil de 0.08Hz
  const breathLfo = ctx.createOscillator();
  const breathGain = ctx.createGain();
  breathLfo.type = "sine";
  breathLfo.frequency.setValueAtTime(0.08, now);
  breathGain.gain.setValueAtTime(35, now);
  breathLfo.connect(breathGain);
  breathGain.connect(filter.frequency);

  const panner = ctx.createStereoPanner();
  const panLfo = ctx.createOscillator();
  const panGain = ctx.createGain();
  panLfo.type = "sine";
  panLfo.frequency.setValueAtTime(0.03, now);
  panGain.gain.setValueAtTime(0.15, now);
  panLfo.connect(panGain);
  panGain.connect(panner.pan);

  oscBase.connect(filter);
  fifthGain.connect(filter);
  thirdGain.connect(filter);
  filter.connect(panner);
  panner.connect(droneGain);

  for (const src of [oscBase, oscFifth, oscThird, breathLfo, panLfo]) src.start(now);

  // Campanadas iniciales inmediatas (1.2s) y rítmicas cada 4.5-7.5s
  let chimeTimerId: number | undefined;
  const scheduleNext = (delayMs: number) => {
    chimeTimerId = window.setTimeout(() => {
      playGenerativeChime(ctx, destination);
      scheduleNext(4500 + Math.random() * 3000);
    }, delayMs);
  };
  scheduleNext(1200);

  const stop = () => {
    if (chimeTimerId !== undefined) window.clearTimeout(chimeTimerId);
    const stopTime = ctx.currentTime + 0.12;
    droneGain.gain.cancelScheduledValues(ctx.currentTime);
    droneGain.gain.setValueAtTime(droneGain.gain.value, ctx.currentTime);
    droneGain.gain.linearRampToValueAtTime(0, stopTime);

    window.setTimeout(() => {
      try {
        for (const node of [oscBase, oscFifth, oscThird, breathLfo, panLfo]) node.stop();
        droneGain.disconnect();
      } catch {
        // Nodos ya cerrados
      }
    }, 150);
  };

  return { gainNode: droneGain, stop };
};

export const synthesizeInharmonicGlass = (
  ctx: AudioContext,
  destination: GainNode,
  fundamental = 432,
): void => {
  const now = ctx.currentTime;
  const strikeGain = ctx.createGain();
  strikeGain.connect(destination);

  let primaryOsc: OscillatorNode | null = null;
  for (const { ratio, gainRatio, decayDuration } of INHARMONIC_MODES) {
    const osc = ctx.createOscillator();
    const modeGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(fundamental * ratio, now);

    modeGain.gain.setValueAtTime(0.0001, now);
    // Ataque suave de 60ms para entrada acogedora sin golpe
    modeGain.gain.linearRampToValueAtTime(0.09 * gainRatio, now + 0.06);
    modeGain.gain.exponentialRampToValueAtTime(0.0001, now + decayDuration);

    osc.connect(modeGain);
    modeGain.connect(strikeGain);
    osc.start(now);
    osc.stop(now + decayDuration + 0.05);

    if (ratio === 1.0) primaryOsc = osc;
  }

  if (primaryOsc) primaryOsc.onended = () => strikeGain.disconnect();
};

export const synthesizeTactileImpulse = (
  ctx: AudioContext,
  destination: GainNode,
  isTap: boolean,
): void => {
  const now = ctx.currentTime;
  const impulseGain = ctx.createGain();
  impulseGain.connect(destination);

  const baseFreq = isTap ? 2160 : 2592;
  const duration = isTap ? 0.03 : 0.012;
  const peakVolume = isTap ? 0.035 : 0.016;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, now + duration);

  impulseGain.gain.setValueAtTime(0.0001, now);
  impulseGain.gain.linearRampToValueAtTime(peakVolume, now + 0.002);
  impulseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(impulseGain);
  osc.start(now);
  osc.stop(now + duration + 0.005);
  osc.onended = () => impulseGain.disconnect();
};
