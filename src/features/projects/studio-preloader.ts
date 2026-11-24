import { gsap } from "gsap";
import type { StudioLoadProgress } from "./studio-loading-tracker";

export interface StudioPreloaderHandle {
  readonly update: (state: StudioLoadProgress) => void;
  readonly finishAndReveal: (onRevealStart: () => void) => Promise<void>;
  readonly dispose: () => void;
}

export const createStudioPreloader = (root: HTMLElement | null): StudioPreloaderHandle | null => {
  if (!root) return null;
  const valueEl = root.querySelector<HTMLElement>("[data-preloader-value]");
  const blurEl = root.querySelector<SVGFEGaussianBlurElement>("[data-preloader-blur]");

  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  root.dataset.active = "true";
  delete root.dataset.dismissed;
  gsap.set(root, { opacity: 1 });
  if (valueEl) {
    valueEl.style.display = "";
    gsap.set(valueEl, { opacity: 1, scale: prefersReduced ? 1 : 0.94, y: 0 });
  }

  let [targetProgress, displayProgress, lastRenderedInt, lastWght, lastBlurX] = [0, 0, -1, -1, -1];
  let [isReady, isDisposed, isRevealing, filterOn] = [false, false, false, false];
  let rafId: number | null = null;
  let revealTl: gsap.core.Timeline | null = null;
  let lastFrameMs = performance.now();
  let pendingFinishResolve: (() => void) | null = null;
  let revealCallback: (() => void) | null = null;

  const setBlur = (bx: number, by: number): void => {
    if (!blurEl || !valueEl || prefersReduced) return;
    if (bx <= 0.06) {
      if (filterOn) {
        valueEl.style.filter = "none";
        filterOn = false;
        lastBlurX = 0;
      }
      return;
    }
    if (!filterOn) {
      valueEl.style.filter = "url(#construct-loader-morph)";
      filterOn = true;
      lastBlurX = -1;
    }
    if (Math.abs(bx - lastBlurX) < 0.22) return;
    lastBlurX = bx;
    blurEl.setAttribute("stdDeviation", `${bx.toFixed(1)} ${by.toFixed(1)}`);
  };
  const setWeight = (rawWght: number, step = 10): void => {
    if (!valueEl || prefersReduced) return;
    const q = Math.round(rawWght / step) * step;
    if (q === lastWght) return;
    lastWght = q;
    valueEl.style.fontVariationSettings = `"wght" ${q}`;
  };
  const paintProgress = (ratio: number): void => {
    const p = Math.max(0, Math.min(1, ratio));
    const pct = Math.round(p * 100);
    if (valueEl) {
      if (pct !== lastRenderedInt) {
        lastRenderedInt = pct;
        valueEl.textContent = pct >= 100 ? "100" : String(pct).padStart(2, "0");
      }
      if (!prefersReduced) {
        setWeight(180 + p ** 0.85 * 700, 10);
        valueEl.style.transform = `scale(${(0.94 + p * 0.06).toFixed(4)})`;
      }
    }
    const soften = (1 - p) ** 1.35;
    setBlur(soften * 8.5, soften * 4.0);
  };
  const runDissolveReveal = (): void => {
    if (isDisposed || isRevealing) return;
    isRevealing = true;
    const done = (): void => {
      root.dataset.dismissed = "true";
      delete root.dataset.active;
      pendingFinishResolve?.();
      pendingFinishResolve = null;
    };
    if (prefersReduced || !valueEl) {
      revealCallback?.();
      gsap.to(root, { opacity: 0, duration: 0.22, ease: "power1.out", onComplete: done });
      return;
    }
    const morphState = { bx: 0, by: 0, wght: 880 };
    revealTl = gsap.timeline({ onComplete: done });
    revealTl.to({}, { duration: 0.06 });
    revealTl.to(
      morphState,
      {
        bx: 15,
        by: 7.5,
        wght: 240,
        duration: 0.28,
        ease: "power2.inOut",
        onUpdate: () => {
          setBlur(morphState.bx, morphState.by);
          setWeight(morphState.wght, 12);
        },
      },
      ">",
    );
    revealTl.to(
      valueEl,
      {
        opacity: 0,
        scale: 1.07,
        duration: 0.28,
        ease: "power3.inOut",
        force3D: true,
        onComplete: () => {
          valueEl.style.filter = "none";
          valueEl.style.display = "none";
        },
      },
      "<",
    );
    revealTl.call(() => revealCallback?.(), [], ">");
    revealTl.to(root, { opacity: 0, duration: 0.56, ease: "power2.out" }, "<");
  };

  const tick = (now: number): void => {
    if (isDisposed) return;
    const dt = Math.min((now - lastFrameMs) / 1000, 0.05);
    lastFrameMs = now;
    if (prefersReduced) {
      displayProgress = targetProgress;
    } else {
      const rate = isReady ? 9.5 : 5.8;
      const step = (targetProgress - displayProgress) * (1 - Math.exp(-rate * dt));
      const minStep = isReady ? Math.min(targetProgress - displayProgress, dt * 1.35) : 0;
      displayProgress = Math.min(targetProgress, displayProgress + Math.max(step, minStep));
      if (targetProgress - displayProgress < 0.0025) displayProgress = targetProgress;
    }
    paintProgress(displayProgress);
    if (isReady && displayProgress >= 0.999) {
      paintProgress(1);
      setBlur(0, 0);
      rafId = null;
      if (revealCallback) runDissolveReveal();
      return;
    }
    rafId =
      Math.abs(targetProgress - displayProgress) > 0.0005 || isReady
        ? requestAnimationFrame(tick)
        : null;
  };

  const ensureTicking = (): void => {
    if (rafId !== null || isDisposed || isRevealing) return;
    lastFrameMs = performance.now();
    rafId = requestAnimationFrame(tick);
  };

  const update = (state: StudioLoadProgress): void => {
    if (isDisposed) return;
    isReady = isReady || state.ready;
    const capped = isReady ? 1 : Math.min(0.99, state.progress);
    targetProgress = Math.max(targetProgress, capped);
    ensureTicking();
  };

  const finishAndReveal = (onRevealStart: () => void): Promise<void> => {
    if (isDisposed) {
      onRevealStart();
      return Promise.resolve();
    }
    revealCallback = onRevealStart;
    isReady = true;
    targetProgress = 1;

    return new Promise<void>((resolve) => {
      pendingFinishResolve = resolve;
      if (displayProgress >= 0.999) {
        paintProgress(1);
        setBlur(0, 0);
        runDissolveReveal();
      } else ensureTicking();
    });
  };

  const dispose = (): void => {
    isDisposed = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
    revealTl?.kill();
    gsap.killTweensOf(valueEl ? [root, valueEl] : root);
    revealCallback = null;
    pendingFinishResolve?.();
    pendingFinishResolve = null;
  };

  paintProgress(0);
  return { update, finishAndReveal, dispose };
};
