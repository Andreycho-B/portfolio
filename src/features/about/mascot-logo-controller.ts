import { gsap } from "gsap";
import type Lenis from "lenis";
import { initMascotEyes, type MascotEyesController } from "./mascot-eyes";

interface MascotLogoHandle {
  readonly cleanup: () => void;
  readonly triggerBlink: (double?: boolean) => void;
}

export const initMascotLogo = (lenis: Lenis | null): MascotLogoHandle | null => {
  const logoEl = document.getElementById("center-brand-logo");
  if (!logoEl) return null;

  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let eyesController: MascotEyesController | undefined;
  const leftEye = document.querySelector<SVGElement>("#mascot-eye-left");
  const rightEye = document.querySelector<SVGElement>("#mascot-eye-right");
  if (leftEye && rightEye) {
    eyesController = initMascotEyes({
      leftEye,
      rightEye,
      interactiveZone: logoEl,
    });
  }

  if (prefersReduced) {
    return { cleanup: () => eyesController?.destroy(), triggerBlink: () => {} };
  }

  const floatRig = document.getElementById("mascot-float-rig");
  const floatTween = gsap.to(floatRig ?? logoEl, {
    y: "+=12",
    duration: 3.2,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
  });

  let [lastClientX, lastClientY, pendingX, pendingY, lastTimestamp] = [0, 0, 0, 0, 0];
  let pointerRafId: number | null = null;
  let idleResetTimer: number | undefined;

  const clearIdleTimer = (): void => {
    if (idleResetTimer !== undefined) {
      window.clearTimeout(idleResetTimer);
      idleResetTimer = undefined;
    }
  };

  const resetPose = (instant = false): void => {
    if (pointerRafId !== null) {
      cancelAnimationFrame(pointerRafId);
      pointerRafId = null;
    }
    clearIdleTimer();
    eyesController?.resetGaze(instant);
    if (instant) {
      gsap.killTweensOf(logoEl);
      gsap.set(logoEl, {
        rotateY: 0,
        rotateX: 0,
        rotateZ: 0,
        rotation: 0,
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        scale: 1,
      });
      return;
    }
    gsap.to(logoEl, {
      rotateY: 0,
      rotateX: 0,
      rotateZ: 0,
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      duration: 0.85,
      ease: "elastic.out(1, 0.55)",
      overwrite: true,
    });
  };

  const flushPointerMove = (): void => {
    pointerRafId = null;
    const now = performance.now();
    const dt = Math.max(now - lastTimestamp, 16);
    lastTimestamp = now;

    const [dx, dy] = [pendingX - lastClientX, pendingY - lastClientY];
    [lastClientX, lastClientY] = [pendingX, pendingY];
    const velocityX = Math.max(Math.min(dx / dt, 2.5), -2.5);
    const velocityY = Math.max(Math.min(dy / dt, 2.5), -2.5);
    const normX = (pendingX / Math.max(1, window.innerWidth)) * 2 - 1;
    const normY = -(pendingY / Math.max(1, window.innerHeight)) * 2 + 1;
    const stretchFactor = Math.min(Math.hypot(velocityX, velocityY) * 0.02, 0.05);

    gsap.to(logoEl, {
      rotateY: normX * 22,
      rotateX: normY * 18,
      rotateZ: normX * 3.5 + velocityX * 2.2,
      x: normX * 18,
      y: -normY * 14,
      scaleX: 1 - stretchFactor * 0.5,
      scaleY: 1 + stretchFactor * 0.5,
      duration: 0.65,
      ease: "power2.out",
      overwrite: "auto",
      onComplete: () => {
        gsap.to(logoEl, {
          rotateZ: normX * 3.5,
          scaleX: 1,
          scaleY: 1,
          duration: 0.5,
          ease: "elastic.out(1.1, 0.4)",
        });
      },
    });
    clearIdleTimer();
    idleResetTimer = window.setTimeout(() => resetPose(false), 1100);
  };

  const handlePointerMove = (e: PointerEvent): void => {
    if (e.pointerType !== "mouse") return;
    [pendingX, pendingY] = [e.clientX, e.clientY];
    if (pointerRafId === null) pointerRafId = requestAnimationFrame(flushPointerMove);
  };

  const handlePointerLeave = (): void => resetPose(false);
  const handleInstantReset = (): void => resetPose(true);
  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  document.documentElement.addEventListener("mouseleave", handlePointerLeave);
  window.addEventListener("blur", handlePointerLeave);
  window.addEventListener("studio-tv:reset-pose", handleInstantReset);

  let lastScrollY = window.scrollY;
  const triggerInertia = (delta: number) => {
    gsap.to(logoEl, {
      rotation: delta * 0.05,
      scale: 1 + Math.min(Math.abs(delta) * 0.0012, 0.08),
      duration: 0.45,
      ease: "power2.out",
      overwrite: "auto",
      onComplete: () => {
        gsap.to(logoEl, {
          rotation: 0,
          scale: 1,
          duration: 0.65,
          ease: "elastic.out(1, 0.45)",
          overwrite: "auto",
        });
      },
    });
  };

  let unbindScroll: () => void;
  if (lenis) {
    const onLenisScroll = ({ velocity }: { velocity: number }) => {
      triggerInertia(velocity * 0.9);
      eyesController?.setScrollVelocity(velocity);
    };
    lenis.on("scroll", onLenisScroll);
    unbindScroll = () => lenis.off("scroll", onLenisScroll);
  } else {
    const onNativeScroll = () => {
      const delta = window.scrollY - lastScrollY;
      lastScrollY = window.scrollY;
      triggerInertia(delta);
      eyesController?.setScrollVelocity(delta);
    };
    window.addEventListener("scroll", onNativeScroll, { passive: true });
    unbindScroll = () => window.removeEventListener("scroll", onNativeScroll);
  }

  return {
    cleanup: () => {
      if (pointerRafId !== null) cancelAnimationFrame(pointerRafId);
      clearIdleTimer();
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener("mouseleave", handlePointerLeave);
      window.removeEventListener("blur", handlePointerLeave);
      window.removeEventListener("studio-tv:reset-pose", handleInstantReset);
      unbindScroll();
      floatTween.kill();
      gsap.killTweensOf(logoEl);
      eyesController?.destroy();
    },
    triggerBlink: (double = true) => {
      eyesController?.blink(double);
    },
  };
};
