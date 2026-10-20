import { gsap } from "gsap";

export interface TiltFxController {
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
    const updateRect = () => {
      rect = card.getBoundingClientRect();
    };

    const handlePointerEnter = () => {
      updateRect();
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (rect.width === 0 || rect.height === 0) updateRect();

      const clientX = e.clientX;
      const clientY = e.clientY;
      const normX = Math.max(-1, Math.min(1, ((clientX - rect.left) / rect.width) * 2 - 1));
      const normY = Math.max(-1, Math.min(1, ((clientY - rect.top) / rect.height) * 2 - 1));

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

    const handlePointerLeave = () => {
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
      card.removeEventListener("pointerenter", handlePointerEnter);
      card.removeEventListener("pointermove", handlePointerMove);
      card.removeEventListener("pointerleave", handlePointerLeave);
      gsap.killTweensOf(inner);
      if (img) gsap.killTweensOf(img);
    });
  });

  return {
    destroy: () => {
      cleanups.forEach((fn) => {
        fn();
      });
    },
  };
};
