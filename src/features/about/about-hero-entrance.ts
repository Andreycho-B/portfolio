import { gsap } from "gsap";
import type Lenis from "lenis";

export interface HeroEntranceOptions {
  readonly onBlink?: (double?: boolean) => void;
  readonly lenis?: Lenis | null;
}

export const initAboutHeroEntrance = (options?: HeroEntranceOptions): (() => void) => {
  const leftCol = document.querySelector<HTMLElement>(".editorial-left");
  const rightCol = document.querySelector<HTMLElement>(".editorial-right");
  const mascotBox = document.getElementById("logo-interactive-box");
  const stageGrid = document.querySelector<HTMLElement>(".editorial-stage-grid");

  if (!leftCol || !rightCol || !mascotBox) return () => {};

  const leftPara = leftCol.querySelector<HTMLElement>(".editorial-paragraph") ?? leftCol;
  const rightPara = rightCol.querySelector<HTMLElement>(".editorial-paragraph") ?? rightCol;

  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReduced) {
    gsap.set([mascotBox, leftPara, rightPara], {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      filter: "none",
      clearProps: "all",
    });
    return () => {};
  }

  gsap.set(mascotBox, {
    opacity: 0,
    scale: 0.78,
    y: 52,
    rotateX: 18,
    filter: "blur(14px)",
    transformOrigin: "center center",
  });

  gsap.set(leftPara, {
    opacity: 0,
    x: -24,
    y: 36,
    filter: "blur(10px)",
  });

  gsap.set(rightPara, {
    opacity: 0,
    x: 24,
    y: 36,
    filter: "blur(10px)",
  });

  const tl = gsap.timeline({
    delay: 0.1,
    onComplete: () => {
      gsap.set([mascotBox, leftPara, rightPara], {
        clearProps: "transform,filter,opacity",
      });
    },
  });

  tl.to(
    mascotBox,
    {
      opacity: 1,
      duration: 1.15,
      ease: "sine.out",
    },
    0,
  );

  tl.to(
    mascotBox,
    {
      scale: 1,
      y: 0,
      rotateX: 0,
      duration: 1.5,
      ease: "expo.out",
    },
    0,
  );

  tl.to(
    mascotBox,
    {
      filter: "blur(0px)",
      duration: 1.1,
      ease: "power2.out",
    },
    0,
  );

  if (options?.onBlink) {
    tl.add(() => {
      options.onBlink?.(true);
    }, 0.58);
  }

  tl.to(
    leftPara,
    {
      x: 0,
      y: 0,
      duration: 1.35,
      ease: "power4.out",
    },
    0.26,
  );

  tl.to(
    leftPara,
    {
      opacity: 1,
      duration: 1.05,
      ease: "sine.out",
    },
    0.26,
  );

  tl.to(
    leftPara,
    {
      filter: "blur(0px)",
      duration: 1.05,
      ease: "power2.out",
    },
    0.26,
  );

  tl.to(
    rightPara,
    {
      x: 0,
      y: 0,
      duration: 1.35,
      ease: "power4.out",
    },
    0.4,
  );

  tl.to(
    rightPara,
    {
      opacity: 1,
      duration: 1.05,
      ease: "sine.out",
    },
    0.4,
  );

  tl.to(
    rightPara,
    {
      filter: "blur(0px)",
      duration: 1.05,
      ease: "power2.out",
    },
    0.4,
  );

  const updateScrollBlur = (scrollY: number) => {
    if (prefersReduced) return;

    const maxScroll = Math.max(stageGrid ? stageGrid.offsetHeight * 0.85 : 460, 360);
    const progress = Math.min(Math.max(scrollY / maxScroll, 0), 1);

    if (progress > 0.02 && tl.isActive()) {
      tl.kill();
    }

    if (progress <= 0.01) {
      if (!tl.isActive()) {
        mascotBox.style.filter = "";
        mascotBox.style.opacity = "";
        mascotBox.style.transform = "";
        mascotBox.style.pointerEvents = "";

        leftPara.style.filter = "";
        leftPara.style.opacity = "";
        leftPara.style.transform = "";

        rightPara.style.filter = "";
        rightPara.style.opacity = "";
        rightPara.style.transform = "";
      }
      return;
    }

    const blurCurve = progress ** 1.15;
    const opacityCurve = progress ** 1.1;

    const mascotBlur = (blurCurve * 16).toFixed(2);
    const textBlur = (blurCurve * 12).toFixed(2);

    const mascotOpacity = Math.max(0, 1 - opacityCurve * 1.15).toFixed(3);
    const textOpacity = Math.max(0, 1 - opacityCurve * 1.25).toFixed(3);

    const mascotScale = (1 - progress * 0.08).toFixed(3);
    const mascotY = (progress * 42).toFixed(1);
    const textX = (progress * 22).toFixed(1);
    const textY = (progress * 26).toFixed(1);

    mascotBox.style.filter = `blur(${mascotBlur}px)`;
    mascotBox.style.opacity = mascotOpacity;
    mascotBox.style.transform = `translate3d(0, ${mascotY}px, 0) scale(${mascotScale})`;
    mascotBox.style.pointerEvents = progress >= 0.85 ? "none" : "";

    leftPara.style.filter = `blur(${textBlur}px)`;
    leftPara.style.opacity = textOpacity;
    leftPara.style.transform = `translate3d(-${textX}px, ${textY}px, 0)`;

    rightPara.style.filter = `blur(${textBlur}px)`;
    rightPara.style.opacity = textOpacity;
    rightPara.style.transform = `translate3d(${textX}px, ${textY}px, 0)`;
  };

  if (typeof window !== "undefined" && window.scrollY > 40) {
    tl.kill();
    updateScrollBlur(window.scrollY);
  }

  let unbindScroll: () => void;
  if (options?.lenis) {
    const onLenisScroll = ({ scroll }: { scroll: number }) => {
      updateScrollBlur(scroll);
    };
    options.lenis.on("scroll", onLenisScroll);
    unbindScroll = () => {
      options.lenis?.off("scroll", onLenisScroll);
    };
  } else {
    const onNativeScroll = () => {
      updateScrollBlur(window.scrollY);
    };
    window.addEventListener("scroll", onNativeScroll, { passive: true });
    unbindScroll = () => {
      window.removeEventListener("scroll", onNativeScroll);
    };
  }

  return () => {
    tl.kill();
    unbindScroll();
  };
};
