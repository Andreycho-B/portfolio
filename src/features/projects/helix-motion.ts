import { gsap } from "gsap";
import { PX_PER_SLOT } from "./helix-input";

const DAMPING_LAMBDA = 5.2;
const MAX_VELOCITY_SLOTS_PER_SEC = 14.0;
const VELOCITY_FILTER_LAMBDA = 10.0;
const FLOW_EPSILON = 5e-4;
const SNAP_VELOCITY_EPSILON = 0.01;

type HelixMotionDeps = {
  /** Vuelca el estado de avance a la coreografía de tarjetas (world.setAdvance) */
  readonly applyToWorld: (advance: number, velocity: number, introProgress: number) => void;
  /** Reactiva el bucle de render de la escena */
  readonly requestRender: () => void;
  /** Periodo de la hélice en slots: el avance es periódico (cardCount) */
  readonly periodSlots: number;
  readonly reducedMotion: boolean;
};

export type HelixMotion = {
  /** Suma `deltaPx` de gestos (rueda/arrastre) al avance objetivo de la hélice */
  readonly advanceBy: (deltaPx: number) => void;
  readonly advanceTo: (slots: number) => void;
  /** Avanza la simulación `dtSeconds`; devuelve true si volcó un nuevo estado al mundo */
  readonly tick: (dtSeconds: number) => boolean;
  /** Dispara la animación de despliegue helicoidal 3D de entrada */
  readonly playIntro: () => Promise<void>;
  readonly dispose: () => void;
};

export const createHelixMotion = (deps: HelixMotionDeps): HelixMotion => {
  let targetAdvance = 0;
  let currentAdvance = 0;
  let smoothedVelocity = 0;
  let introProgress = 1;
  let introTween: gsap.core.Tween | null = null;

  const modulo = (value: number, period: number): number => ((value % period) + period) % period;

  const advanceBy = (deltaPx: number): void => {
    targetAdvance += deltaPx / PX_PER_SLOT;
    if (deps.reducedMotion) {
      currentAdvance = targetAdvance;
      deps.applyToWorld(currentAdvance, 0, introProgress);
    }
    deps.requestRender();
  };

  const advanceTo = (slots: number): void => {
    // Envuelve al equivalente congruente más cercano: la hélice es periódica
    // (periodSlots) y un target absoluto tras un scroll largo obligaría a
    // recorrer decenas de slots hacia atrás.
    const wrapDelta = modulo(slots - currentAdvance, deps.periodSlots);
    targetAdvance =
      currentAdvance +
      (wrapDelta > deps.periodSlots / 2 ? wrapDelta - deps.periodSlots : wrapDelta);
    if (deps.reducedMotion) {
      currentAdvance = targetAdvance;
      deps.applyToWorld(currentAdvance, 0, introProgress);
    }
    deps.requestRender();
  };

  const tick = (dtSeconds: number): boolean => {
    const distance = targetAdvance - currentAdvance;

    if (!deps.reducedMotion && Math.abs(distance) > FLOW_EPSILON) {
      const dampingFactor = 1 - Math.exp(-DAMPING_LAMBDA * dtSeconds);
      const rawStep = distance * dampingFactor;
      const maxStep = MAX_VELOCITY_SLOTS_PER_SEC * dtSeconds;
      const clampedStep = Math.sign(rawStep) * Math.min(Math.abs(rawStep), maxStep);
      currentAdvance += clampedStep;

      const instantVelocity = clampedStep / dtSeconds;
      const filterFactor = 1 - Math.exp(-VELOCITY_FILTER_LAMBDA * dtSeconds);
      smoothedVelocity += (instantVelocity - smoothedVelocity) * filterFactor;

      deps.applyToWorld(currentAdvance, smoothedVelocity, introProgress);
      return true;
    }

    if (currentAdvance !== targetAdvance || Math.abs(smoothedVelocity) > SNAP_VELOCITY_EPSILON) {
      currentAdvance = targetAdvance;
      smoothedVelocity = 0;
      deps.applyToWorld(currentAdvance, 0, introProgress);
      return true;
    }

    return false;
  };

  const playIntro = (): Promise<void> => {
    if (deps.reducedMotion) {
      introProgress = 1;
      deps.applyToWorld(currentAdvance, 0, 1);
      deps.requestRender();
      return Promise.resolve();
    }

    introProgress = 0;
    deps.applyToWorld(currentAdvance, 0, 0);
    deps.requestRender();

    return new Promise<void>((resolve) => {
      introTween?.kill();
      const proxy = { value: 0 };
      introTween = gsap.to(proxy, {
        value: 1,
        duration: 1.6,
        ease: "power2.out",
        onUpdate: () => {
          introProgress = proxy.value;
          deps.applyToWorld(currentAdvance, smoothedVelocity, introProgress);
          deps.requestRender();
        },
        onComplete: () => {
          introProgress = 1;
          deps.applyToWorld(currentAdvance, smoothedVelocity, 1);
          deps.requestRender();
          resolve();
        },
      });
    });
  };

  const dispose = (): void => {
    introTween?.kill();
  };

  return { advanceBy, advanceTo, tick, playIntro, dispose };
};
