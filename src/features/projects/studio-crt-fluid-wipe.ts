import { gsap } from "gsap";

export type StudioFluidWaveVec = readonly [number, number, number, number];

export interface StudioCrtFluidWipeHandle {
  readonly getWave: () => StudioFluidWaveVec;
  readonly isActive: () => boolean;
  readonly isCovering: () => boolean;
  readonly startSweepIn: (onCovered: () => void) => void;
  readonly startSweepOut: (onComplete?: () => void) => void;
  readonly cancel: () => void;
  readonly dispose: () => void;
}

const SWEEP_IN_SEC = 0.48;
const SWEEP_OUT_SEC = 0.56;
const STAGGER_SEC = 0.06;

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const createStudioCrtFluidWipe = (onTick: () => void): StudioCrtFluidWipeHandle => {
  const wave = { leadIn: 0, bodyIn: 0, bodyOut: 0, leadOut: 0 };
  let phase: "idle" | "in" | "covered" | "out" = "idle";
  let activeTl: gsap.core.Timeline | null = null;

  const killTl = (): void => {
    if (activeTl) {
      activeTl.kill();
      activeTl = null;
    }
  };

  const resetWave = (): void => {
    wave.leadIn = 0;
    wave.bodyIn = 0;
    wave.bodyOut = 0;
    wave.leadOut = 0;
    phase = "idle";
  };

  const startSweepIn = (onCovered: () => void): void => {
    killTl();
    if (prefersReducedMotion()) {
      wave.leadIn = 1;
      wave.bodyIn = 1;
      wave.bodyOut = 0;
      wave.leadOut = 0;
      phase = "covered";
      onTick();
      onCovered();
      return;
    }
    wave.leadIn = 0;
    wave.bodyIn = 0;
    wave.bodyOut = 0;
    wave.leadOut = 0;
    phase = "in";
    onTick();

    activeTl = gsap.timeline({
      onUpdate: onTick,
      onComplete: () => {
        activeTl = null;
        wave.leadIn = 1;
        wave.bodyIn = 1;
        phase = "covered";
        onTick();
        onCovered();
      },
    });
    activeTl.to(wave, { leadIn: 1, duration: SWEEP_IN_SEC, ease: "power4.inOut" }, 0);
    activeTl.to(wave, { bodyIn: 1, duration: SWEEP_IN_SEC, ease: "power4.inOut" }, STAGGER_SEC);
  };

  const startSweepOut = (onComplete?: () => void): void => {
    killTl();
    if (prefersReducedMotion()) {
      resetWave();
      onTick();
      onComplete?.();
      return;
    }
    wave.leadIn = 1;
    wave.bodyIn = 1;
    wave.bodyOut = 0;
    wave.leadOut = 0;
    phase = "out";
    onTick();

    activeTl = gsap.timeline({
      onUpdate: onTick,
      onComplete: () => {
        activeTl = null;
        resetWave();
        onTick();
        onComplete?.();
      },
    });
    activeTl.to(wave, { bodyOut: 1, duration: SWEEP_OUT_SEC, ease: "power4.inOut" }, 0);
    activeTl.to(wave, { leadOut: 1, duration: SWEEP_OUT_SEC, ease: "power4.inOut" }, STAGGER_SEC);
  };

  const cancel = (): void => {
    killTl();
    resetWave();
    onTick();
  };

  return {
    getWave: () => [wave.leadIn, wave.bodyIn, wave.bodyOut, wave.leadOut],
    isActive: () => phase !== "idle",
    isCovering: () => phase === "covered",
    startSweepIn,
    startSweepOut,
    cancel,
    dispose: () => {
      killTl();
      resetWave();
    },
  };
};
