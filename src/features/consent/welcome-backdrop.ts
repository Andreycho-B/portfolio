import { gsap } from "gsap";

export interface WelcomeBackdropHandle {
  readonly expand: () => void;
  readonly destroy: () => void;
}

export const initWelcomeBackdrop = (rootEl: HTMLElement): WelcomeBackdropHandle | null => {
  const boxEl = rootEl.querySelector<HTMLElement>("[data-blue-box]");
  if (!boxEl) return null;

  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let timeline: gsap.core.Timeline | null = null;
  let isExpanded = false;

  const expand = () => {
    if (isExpanded) return;
    isExpanded = true;

    if (prefersReduced) {
      rootEl.dataset.backdropActive = "true";
      boxEl.classList.add("is-expanding");
      gsap.set(boxEl, {
        opacity: 1,
        width: "130vmax",
        height: "130vmax",
        borderRadius: "0px",
      });
      document.dispatchEvent(new CustomEvent("welcome:backdrop-covered"));
      return;
    }

    const lineLength = Math.min(Math.max(window.innerWidth * 0.46, 520), window.innerWidth * 0.9);
    const rectHeight = 160;
    const initialScaleY = 3 / rectHeight;

    gsap.set(boxEl, {
      width: lineLength,
      height: rectHeight,
      xPercent: -50,
      yPercent: -50,
      scaleX: 0,
      scaleY: initialScaleY,
      opacity: 1,
      borderRadius: 0,
      force3D: true,
      transformOrigin: "50% 50%",
    });

    timeline = gsap.timeline({
      onComplete: () => {
        timeline = null;
      },
    });

    timeline.to(
      boxEl,
      {
        scaleX: 1,
        duration: 1.35,
        ease: "power2.inOut",
        force3D: true,
      },
      0.35,
    );

    timeline.to(boxEl, {
      scaleY: 1,
      duration: 0.65,
      ease: "power2.out",
      force3D: true,
    });

    const targetScaleX = (window.innerWidth * 1.5) / lineLength;
    const targetScaleY = (window.innerHeight * 1.5) / rectHeight;
    const finalScale = Math.max(targetScaleX, targetScaleY);

    timeline.to(
      boxEl,
      {
        scaleX: finalScale,
        scaleY: finalScale,
        duration: 1.35,
        ease: "power3.inOut",
        force3D: true,
        onStart: () => {
          boxEl.classList.add("is-expanding");
          gsap.delayedCall(0.7, () => {
            rootEl.dataset.backdropActive = "true";
            document.dispatchEvent(new CustomEvent("welcome:backdrop-covered"));
          });
        },
      },
      "+=0.65",
    );
  };

  const onPhraseExited = (evt: Event) => {
    const customEvt = evt as CustomEvent<{ phraseIndex: number; phrase: string; role: string }>;
    const detail = customEvt.detail;
    if (detail && detail.role === "identity") {
      expand();
    }
  };

  document.addEventListener("morphic:phrase-exited", onPhraseExited);

  const destroy = () => {
    if (timeline) {
      timeline.kill();
      timeline = null;
    }
    document.removeEventListener("morphic:phrase-exited", onPhraseExited);
  };

  document.addEventListener("astro:before-swap", destroy, { once: true });

  return { expand, destroy };
};
