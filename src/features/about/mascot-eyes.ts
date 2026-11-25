import { gsap } from "gsap";
import { getAudioSystem } from "../../core/audio";

interface MascotEyesOptions {
  readonly leftEye: SVGElement;
  readonly rightEye: SVGElement;
  readonly interactiveZone?: HTMLElement;
}

export interface MascotEyesController {
  readonly blink: (doubleBlink?: boolean) => void;
  readonly wink: (which?: "left" | "right") => void;
  readonly resetGaze: (instant?: boolean) => void;
  readonly setScrollVelocity: (velocity: number) => void;
  readonly destroy: () => void;
}

export const initMascotEyes = (options: MascotEyesOptions): MascotEyesController => {
  const { leftEye, rightEye, interactiveZone } = options;
  const audio = getAudioSystem();
  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let timerId: number | undefined;
  let saccadeTimerId: number | undefined;
  let isDestroyed = false;
  let isBlinking = false;

  const eyes = [leftEye, rightEye];
  const leftPupil = leftEye.querySelector<SVGElement>(".mascot-pupil") ?? leftEye;
  const rightPupil = rightEye.querySelector<SVGElement>(".mascot-pupil") ?? rightEye;
  const pupils = [leftPupil, rightPupil];

  gsap.set(pupils, { transformOrigin: "50% 85%" });

  const executeBlink = (targets: SVGElement[], onComplete?: () => void): void => {
    if (prefersReduced) return;
    const tl = gsap.timeline({ onComplete: () => onComplete?.() });
    tl.to(targets, { scaleY: 0.05, scaleX: 1.15, y: 3.5, duration: 0.075, ease: "power2.in" });
    tl.to(targets, { duration: 0.025 });
    tl.to(targets, { scaleY: 1, scaleX: 1, y: 0, duration: 0.14, ease: "power2.out" });
  };

  const blink = (forceDouble = false): void => {
    if (isBlinking || isDestroyed || prefersReduced) return;
    isBlinking = true;

    const isDouble = forceDouble || Math.random() < 0.22;

    executeBlink(pupils, () => {
      if (isDouble && !isDestroyed) {
        window.setTimeout(() => {
          if (isDestroyed) return;
          executeBlink(pupils, () => {
            isBlinking = false;
          });
        }, 90);
      } else {
        isBlinking = false;
      }
    });
  };

  const wink = (which: "left" | "right" = "left"): void => {
    if (isBlinking || isDestroyed || prefersReduced) return;
    isBlinking = true;
    const target = which === "left" ? [leftPupil] : [rightPupil];
    audio.playTactileFeedback("tick", 0.45);
    executeBlink(target, () => {
      isBlinking = false;
    });
  };

  const scheduleNextBlink = (): void => {
    if (isDestroyed) return;
    const delayMs = Math.floor(2400 + Math.random() * 3400);
    timerId = window.setTimeout(() => {
      blink();
      scheduleNextBlink();
    }, delayMs);
  };

  let saccadeOffsetX = 0;
  let saccadeOffsetY = 0;
  let pointerRafId: number | null = null;
  let pendingClientX = 0;
  let pendingClientY = 0;

  const flushGaze = (): void => {
    pointerRafId = null;
    if (isDestroyed || prefersReduced) return;
    const normX = (pendingClientX / Math.max(1, window.innerWidth)) * 2 - 1;
    const normY = (pendingClientY / Math.max(1, window.innerHeight)) * 2 - 1;
    gsap.to(eyes, {
      x: normX * 5.2 + saccadeOffsetX,
      y: normY * 4.6 + saccadeOffsetY,
      duration: 0.42,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  const handlePointerMove = (e: PointerEvent): void => {
    if (prefersReduced || e.pointerType !== "mouse") return;
    [pendingClientX, pendingClientY] = [e.clientX, e.clientY];
    if (pointerRafId === null) pointerRafId = requestAnimationFrame(flushGaze);
  };

  const scheduleNextSaccade = (): void => {
    if (isDestroyed) return;
    const delayMs = Math.floor(4000 + Math.random() * 4000);
    saccadeTimerId = window.setTimeout(() => {
      if (!isDestroyed && !prefersReduced) {
        saccadeOffsetX = (Math.random() - 0.5) * 2.2;
        saccadeOffsetY = (Math.random() - 0.5) * 1.8;
      }
      scheduleNextSaccade();
    }, delayMs);
  };

  let squintTween: gsap.core.Tween | undefined;
  const setScrollVelocity = (velocity: number): void => {
    if (prefersReduced || isBlinking) return;
    const speed = Math.min(Math.abs(velocity) * 0.0018, 0.45);
    if (speed > 0.06) {
      const targetScaleY = Math.max(0.6, 1 - speed);
      const targetY = (1 - targetScaleY) * 3.5;
      squintTween?.kill();
      squintTween = gsap.to(pupils, {
        scaleY: targetScaleY,
        scaleX: 1.08,
        y: targetY,
        duration: 0.18,
        ease: "power2.out",
        overwrite: "auto",
        onComplete: () => {
          gsap.to(pupils, {
            scaleY: 1,
            scaleX: 1,
            y: 0,
            duration: 0.28,
            ease: "power2.out",
            delay: 0.05,
          });
        },
      });
    }
  };

  const resetGaze = (instant = false): void => {
    if (isDestroyed) return;
    if (pointerRafId !== null) {
      cancelAnimationFrame(pointerRafId);
      pointerRafId = null;
    }
    if (instant || prefersReduced) {
      gsap.killTweensOf(eyes);
      gsap.set(eyes, { x: 0, y: 0 });
      return;
    }
    gsap.to(eyes, { x: 0, y: 0, duration: 0.55, ease: "power2.out", overwrite: "auto" });
  };

  const handleZoneClick = (): void => {
    wink(Math.random() > 0.5 ? "left" : "right");
  };
  const handleZonePointerDown = (): void => {
    audio.playTactileFeedback("tick", 0.3);
  };

  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  interactiveZone?.addEventListener("click", handleZoneClick);
  interactiveZone?.addEventListener("pointerdown", handleZonePointerDown);
  scheduleNextBlink();
  scheduleNextSaccade();

  const destroy = (): void => {
    isDestroyed = true;
    if (pointerRafId !== null) cancelAnimationFrame(pointerRafId);
    window.clearTimeout(timerId);
    window.clearTimeout(saccadeTimerId);
    squintTween?.kill();
    window.removeEventListener("pointermove", handlePointerMove);
    interactiveZone?.removeEventListener("click", handleZoneClick);
    interactiveZone?.removeEventListener("pointerdown", handleZonePointerDown);
    gsap.killTweensOf(eyes);
    gsap.killTweensOf(pupils);
  };

  return { blink, wink, resetGaze, setScrollVelocity, destroy };
};
