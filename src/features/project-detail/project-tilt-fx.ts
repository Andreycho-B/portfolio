import { gsap } from "gsap";

interface TiltFxController {
  readonly destroy: () => void;
}

export const initSpecimensTilt = (root: Document | HTMLElement = document): TiltFxController => {
  const cards = root.querySelectorAll<HTMLElement>("[data-tilt-card]");
  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReduced || cards.length === 0) {
    return { destroy: () => {} };
  }

  const cleanups: (() => void)[] = [];

  cards.forEach((card) => {
    const inner = card.querySelector<HTMLElement>(".device-tilt-inner");
    const img = card.querySelector<HTMLElement>(".device-screen-img");
    if (!inner) return;

    let rect = card.getBoundingClientRect();
    let rafId: number | null = null;
    let latestX = 0;
    let latestY = 0;

    const updateRect = (): void => {
      rect = card.getBoundingClientRect();
    };

    const cancelPendingFrame = (): void => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const flushTilt = (): void => {
      rafId = null;
      if (rect.width === 0 || rect.height === 0) updateRect();
      if (rect.width === 0 || rect.height === 0) return;

      const normX = Math.max(-1, Math.min(1, ((latestX - rect.left) / rect.width) * 2 - 1));
      const normY = Math.max(-1, Math.min(1, ((latestY - rect.top) / rect.height) * 2 - 1));

      gsap.to(inner, {
        rotateY: normX * 7.5,
        rotateX: -normY * 6.5,
        scale: 1.018,
        duration: 0.32,
        ease: "power2.out",
        overwrite: "auto",
      });

      if (img) {
        gsap.to(img, {
          x: -normX * 6,
          y: -normY * 6,
          duration: 0.45,
          ease: "power2.out",
          overwrite: "auto",
        });
      }
    };

    const handlePointerEnter = (): void => {
      updateRect();
    };

    const handlePointerMove = (e: PointerEvent): void => {
      if (e.pointerType !== "mouse") return;
      latestX = e.clientX;
      latestY = e.clientY;
      if (rafId === null) rafId = requestAnimationFrame(flushTilt);
    };

    const handlePointerLeave = (): void => {
      cancelPendingFrame();
      gsap.to(inner, {
        rotateY: 0,
        rotateX: 0,
        scale: 1,
        duration: 0.85,
        ease: "elastic.out(1, 0.38)",
        overwrite: "auto",
      });

      if (img) {
        gsap.to(img, {
          x: 0,
          y: 0,
          duration: 0.85,
          ease: "elastic.out(1, 0.38)",
          overwrite: "auto",
        });
      }
    };

    card.addEventListener("pointerenter", handlePointerEnter, { passive: true });
    card.addEventListener("pointermove", handlePointerMove, { passive: true });
    card.addEventListener("pointerleave", handlePointerLeave, { passive: true });

    cleanups.push(() => {
      cancelPendingFrame();
      card.removeEventListener("pointerenter", handlePointerEnter);
      card.removeEventListener("pointermove", handlePointerMove);
      card.removeEventListener("pointerleave", handlePointerLeave);
      gsap.killTweensOf(inner);
      if (img) gsap.killTweensOf(img);
    });
  });

  return {
    destroy: () => {
      for (const cleanup of cleanups) cleanup();
    },
  };
};
