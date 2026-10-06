import { gsap } from "gsap";

export type TensionState = "idle" | "pulling" | "triggered";

export interface ScrollTensionCallbacks {
  readonly onProgress: (progress: number) => void;
  readonly onTrigger: () => void;
  readonly onReset: () => void;
}

export interface ScrollTensionController {
  readonly enable: () => void;
  readonly disable: () => void;
  readonly destroy: () => void;
}

const TENSION_THRESHOLD = 130;
const DAMPING_FACTOR = 0.55;

export const createScrollTension = (
  containerElement: HTMLElement,
  callbacks: ScrollTensionCallbacks,
): ScrollTensionController => {
  let accumulatedDistance = 0;
  let currentState: TensionState = "idle";
  let isEnabled = false;
  let startPointerY: number | null = null;
  let springAnimation: gsap.core.Tween | null = null;
  let wheelTimeoutId: number | undefined;

  const updateTension = (deltaDistance: number) => {
    if (!isEnabled || currentState === "triggered") return;

    if (springAnimation) {
      springAnimation.kill();
      springAnimation = null;
    }

    accumulatedDistance = Math.max(0, accumulatedDistance + deltaDistance * DAMPING_FACTOR);
    const progressRatio = Math.min(1, accumulatedDistance / TENSION_THRESHOLD);
    callbacks.onProgress(progressRatio);

    if (progressRatio >= 1) {
      currentState = "triggered";
      callbacks.onTrigger();
      return;
    }

    currentState = accumulatedDistance > 0 ? "pulling" : "idle";
  };

  const snapBackToOrigin = () => {
    if (currentState === "triggered" || accumulatedDistance === 0) return;

    const springState = { distance: accumulatedDistance };
    springAnimation = gsap.to(springState, {
      distance: 0,
      duration: 0.6,
      ease: "elastic.out(1, 0.5)",
      onUpdate: () => {
        accumulatedDistance = springState.distance;
        const currentProgress = Math.max(0, accumulatedDistance / TENSION_THRESHOLD);
        callbacks.onProgress(currentProgress);
      },
      onComplete: () => {
        accumulatedDistance = 0;
        currentState = "idle";
        callbacks.onReset();
        springAnimation = null;
      },
    });
  };

  const handleWheel = (event: WheelEvent) => {
    if (!isEnabled || currentState === "triggered") return;
    if (event.deltaY > 0 || accumulatedDistance > 0) {
      event.preventDefault();
      updateTension(event.deltaY);

      window.clearTimeout(wheelTimeoutId);
      wheelTimeoutId = window.setTimeout(snapBackToOrigin, 140);
    }
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (!isEnabled || currentState === "triggered") return;
    startPointerY = event.clientY;
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (!isEnabled || currentState === "triggered" || startPointerY === null) return;
    const verticalMovement = startPointerY - event.clientY;
    if (verticalMovement > 0 || accumulatedDistance > 0) {
      updateTension(verticalMovement * 0.45);
      startPointerY = event.clientY;
    }
  };

  const handlePointerUp = () => {
    startPointerY = null;
    snapBackToOrigin();
  };

  const enable = () => {
    isEnabled = true;
    containerElement.addEventListener("wheel", handleWheel, { passive: false });
    containerElement.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  const disable = () => {
    isEnabled = false;
    containerElement.removeEventListener("wheel", handleWheel);
    containerElement.removeEventListener("pointerdown", handlePointerDown);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerUp);
    if (springAnimation) springAnimation.kill();
  };

  const destroy = () => {
    disable();
    window.clearTimeout(wheelTimeoutId);
  };

  return { enable, disable, destroy };
};
