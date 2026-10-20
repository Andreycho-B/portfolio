import { gsap } from "gsap";
import type Lenis from "lenis";
import { initMascotEyes, type MascotEyesController } from "./mascot-eyes";

export interface MascotLogoHandle {
  readonly cleanup: () => void;
  readonly triggerBlink: (double?: boolean) => void;
}

export const initMascotLogo = (lenis: Lenis | null): MascotLogoHandle | null => {
  const logoEl = document.getElementById("center-brand-logo");
  if (!logoEl) return null;

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

  const floatRig = document.getElementById("mascot-float-rig");
  const floatTween = gsap.to(floatRig ?? logoEl, {
    y: "+=12",
    duration: 3.2,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
  });

  let lastClientX = 0;
  let lastClientY = 0;
  let lastTimestamp = 0;

  const handlePointerMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const now = performance.now();
    const dt = Math.max(now - lastTimestamp, 16);
    lastTimestamp = now;

    const dx = e.clientX - lastClientX;
    const dy = e.clientY - lastClientY;
    lastClientX = e.clientX;
    lastClientY = e.clientY;

    const velocityX = Math.max(Math.min(dx / dt, 2.5), -2.5);
    const velocityY = Math.max(Math.min(dy / dt, 2.5), -2.5);

    const normX = (e.clientX / window.innerWidth) * 2 - 1;
    const normY = -(e.clientY / window.innerHeight) * 2 + 1;

    const targetRotateY = normX * 22;
    const targetRotateX = normY * 18;
    const targetRotateZ = normX * 3.5 + velocityX * 2.2;
    const stretchFactor = Math.min(Math.hypot(velocityX, velocityY) * 0.02, 0.05);

    gsap.to(logoEl, {
      rotateY: targetRotateY,
      rotateX: targetRotateX,
      rotateZ: targetRotateZ,
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
  };
  window.addEventListener("pointermove", handlePointerMove, { passive: true });

  let lastScrollY = window.scrollY;
  const triggerInertia = (delta: number) => {
    gsap.to(logoEl, {
      rotation: delta * 0.05,
      scale: 1 + Math.min(Math.abs(delta) * 0.0012, 0.08),
      duration: 0.45,
      ease: "power2.out",
      onComplete: () => {
        gsap.to(logoEl, { rotation: 0, scale: 1, duration: 0.65, ease: "elastic.out(1, 0.45)" });
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
    unbindScroll = () => {
      lenis.off("scroll", onLenisScroll);
    };
  } else {
    const onNativeScroll = () => {
      const delta = window.scrollY - lastScrollY;
      lastScrollY = window.scrollY;
      triggerInertia(delta);
      eyesController?.setScrollVelocity(delta);
    };
    window.addEventListener("scroll", onNativeScroll, { passive: true });
    unbindScroll = () => {
      window.removeEventListener("scroll", onNativeScroll);
    };
  }

  return {
    cleanup: () => {
      window.removeEventListener("pointermove", handlePointerMove);
      unbindScroll();
      floatTween.kill();
      eyesController?.destroy();
    },
    triggerBlink: (double = true) => {
      eyesController?.blink(double);
    },
  };
};
