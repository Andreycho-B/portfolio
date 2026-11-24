export type NokiaToneKind = "key" | "call" | "snake_start" | "eat" | "back" | "gameover";

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

let sharedCtx: AudioContext | null = null;

const getAudioCtx = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const Ctor =
      window.AudioContext ??
      (window as Window & { readonly webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    sharedCtx = new Ctor();
  }
  if (sharedCtx.state === "suspended") {
    void sharedCtx
      .resume()
      .catch((err: unknown) => console.warn("[StudioNokiaAudio] AudioContext resume failed:", err));
  }
  return sharedCtx;
};

export const playNokiaPiezoTone = (kind: NokiaToneKind, soundEnabled: boolean): void => {
  if (!soundEnabled || (typeof document !== "undefined" && document.hidden)) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime + 0.005;
  for (const step of TONE_SEQUENCES[kind]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(step.freq, now + step.delaySec);
    gain.gain.setValueAtTime(0.0001, now + step.delaySec);
    gain.gain.linearRampToValueAtTime(0.038, now + step.delaySec + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + step.delaySec + step.durSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + step.delaySec);
    osc.stop(now + step.delaySec + step.durSec + 0.01);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
};
