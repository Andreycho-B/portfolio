import { gsap } from "gsap";
import Lenis from "lenis";

let lenisInstance: Lenis | null = null;
let tickerCallback: ((time: number) => void) | null = null;

export interface SmoothScrollOptions {
  readonly duration?: number;
  readonly wheelMultiplier?: number;
  readonly touchMultiplier?: number;
}

export const initSmoothScroll = (options: SmoothScrollOptions = {}): Lenis | null => {
  if (typeof window === "undefined") return null;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    destroySmoothScroll();
    return null;
  }

  if (lenisInstance) {
    destroySmoothScroll();
  }

  const lenis = new Lenis({
    duration: options.duration ?? 1.2,
    easing: (t: number) => Math.min(1, 1.001 - 2 ** (-10 * t)),
    orientation: "vertical",
    gestureOrientation: "vertical",
    smoothWheel: true,
    wheelMultiplier: options.wheelMultiplier ?? 1.0,
    touchMultiplier: options.touchMultiplier ?? 1.3,
    infinite: false,
  });

  tickerCallback = (time: number) => {
    lenis.raf(time * 1000);
  };

  gsap.ticker.add(tickerCallback);
  gsap.ticker.lagSmoothing(0);

  lenisInstance = lenis;
  return lenis;
};

export const destroySmoothScroll = (): void => {
  if (tickerCallback) {
    gsap.ticker.remove(tickerCallback);
    tickerCallback = null;
  }
  if (lenisInstance) {
    lenisInstance.destroy();
    lenisInstance = null;
  }
};
