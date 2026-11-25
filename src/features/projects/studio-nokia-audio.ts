import { getAudioSystem } from "../../core/audio";

type NokiaToneKind = "key" | "call" | "snake_start" | "eat" | "back" | "gameover";

interface ToneStep {
  readonly freq: number;
  readonly durSec: number;
  readonly delaySec: number;
}

const TONE_SEQUENCES: Readonly<Record<NokiaToneKind, readonly ToneStep[]>> = {
  key: [{ freq: 1480, durSec: 0.042, delaySec: 0 }],
  call: [
    { freq: 1318, durSec: 0.06, delaySec: 0 },
    { freq: 1760, durSec: 0.085, delaySec: 0.065 },
  ],
  back: [
    { freq: 1175, durSec: 0.055, delaySec: 0 },
    { freq: 880, durSec: 0.07, delaySec: 0.06 },
  ],
  snake_start: [
    { freq: 659, durSec: 0.055, delaySec: 0 },
    { freq: 784, durSec: 0.055, delaySec: 0.06 },
    { freq: 988, durSec: 0.055, delaySec: 0.12 },
    { freq: 1318, durSec: 0.11, delaySec: 0.18 },
  ],
  eat: [
    { freq: 1046, durSec: 0.032, delaySec: 0 },
    { freq: 1568, durSec: 0.045, delaySec: 0.035 },
  ],
  gameover: [
    { freq: 440, durSec: 0.09, delaySec: 0 },
    { freq: 349, durSec: 0.09, delaySec: 0.1 },
    { freq: 247, durSec: 0.16, delaySec: 0.2 },
  ],
};

export const playNokiaPiezoTone = (kind: NokiaToneKind, soundEnabled: boolean): void => {
  if (!soundEnabled || (typeof document !== "undefined" && document.hidden)) return;
  getAudioSystem().runSynthesis((ctx, destination) => {
    const now = ctx.currentTime + 0.005;
    for (const step of TONE_SEQUENCES[kind]) {
      const start = now + step.delaySec;
      const end = start + step.durSec;
      const osc = ctx.createOscillator();
      const highpass = ctx.createBiquadFilter();
      const lowpass = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(step.freq, start);
      highpass.type = "highpass";
      highpass.frequency.setValueAtTime(340, start);
      highpass.Q.setValueAtTime(Math.SQRT1_2, start);
      lowpass.type = "lowpass";
      lowpass.frequency.setValueAtTime(2600, start);
      lowpass.Q.setValueAtTime(0.85, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.044, start + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0005, end - 0.004);
      gain.gain.linearRampToValueAtTime(0, end);
      osc.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(gain);
      gain.connect(destination);
      osc.start(start);
      osc.stop(end + 0.006);
      osc.onended = () => {
        osc.disconnect();
        highpass.disconnect();
        lowpass.disconnect();
        gain.disconnect();
      };
    }
  });
};
