import { navigate } from "astro:transitions/client";
import { gsap } from "gsap";
import { getAudioSystem } from "../../core/audio";
import { getCursorController } from "../../design-system/components/cursor-controller";
import {
  calculateSweepInPath,
  calculateSweepOutPath,
  getFullCoverPath,
  getHiddenBottomPath,
} from "./fluid-curve-math";
import { getOrCreateFluidOverlay } from "./fluid-wipe-overlay";

export interface FluidTransitionOptions {
  readonly targetUrl: string;
  readonly canvas?: HTMLCanvasElement | null;
  readonly titleElement?: HTMLElement | null;
  readonly onBeforeNavigate?: () => void;
}

const STORAGE_PENDING_KEY = "portfolio_fluid_wipe_pending";

let isTransitioning = false;

const playFluidSweepOut = (): Promise<void> => {
  return new Promise((resolve) => {
    const overlay = getOrCreateFluidOverlay();
    overlay.setPointerEvents(true);

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      gsap.to(overlay.overlayElement, {
        opacity: 0,
        duration: 0.2,
        ease: "power1.out",
        onComplete: () => {
          overlay.setPointerEvents(false);
          overlay.setLeadPath(getHiddenBottomPath());
          overlay.setBodyPath(getHiddenBottomPath());
          gsap.set(overlay.overlayElement, { opacity: 1 });
          isTransitioning = false;
          resolve();
        },
      });
      return;
    }

    overlay.setLeadPath(getFullCoverPath());
    overlay.setBodyPath(getFullCoverPath());

    const tl = gsap.timeline({
      onComplete: () => {
        overlay.setPointerEvents(false);
        overlay.setLeadPath(getHiddenBottomPath());
        overlay.setBodyPath(getHiddenBottomPath());
        isTransitioning = false;
        resolve();
      },
    });

    const leadState = { progress: 0 };
    const bodyState = { progress: 0 };

    tl.to(
      bodyState,
      {
        progress: 1,
        duration: 0.72,
        ease: "power4.inOut",
        onUpdate: () => {
          overlay.setBodyPath(calculateSweepOutPath(bodyState.progress, 0.95));
        },
      },
      0,
    );

    tl.to(
      leadState,
      {
        progress: 1,
        duration: 0.7,
        ease: "power4.inOut",
        onUpdate: () => {
          overlay.setLeadPath(calculateSweepOutPath(leadState.progress, 1.25));
        },
      },
      0.06,
    );
  });
};

export const navigateWithFluidWipe = ({
  targetUrl,
  canvas,
  titleElement,
  onBeforeNavigate,
}: FluidTransitionOptions): void => {
  if (isTransitioning) return;
  isTransitioning = true;

  const audio = getAudioSystem();
  audio.playTactileFeedback("click", 0.85);

  try {
    const cursor = getCursorController();
    cursor.setExpanded(false);
    cursor.setPressed(false);
    cursor.setInverted(false);
  } catch {}

  const overlay = getOrCreateFluidOverlay();
  overlay.setPointerEvents(true);

  try {
    sessionStorage.setItem(STORAGE_PENDING_KEY, "true");
  } catch {}

  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReduced) {
    if (onBeforeNavigate) onBeforeNavigate();
    void navigate(targetUrl);
    return;
  }

  const tl = gsap.timeline({
    onComplete: () => {
      if (onBeforeNavigate) onBeforeNavigate();
      void navigate(targetUrl);
    },
  });

  if (canvas) {
    tl.to(
      canvas,
      {
        scale: 0.9,
        opacity: 0.2,
        duration: 0.55,
        ease: "power3.inOut",
      },
      0,
    );
  }

  if (titleElement) {
    tl.to(
      titleElement,
      {
        y: -32,
        opacity: 0,
        duration: 0.42,
        ease: "power2.in",
      },
      0,
    );
  }

  const leadState = { progress: 0 };
  const bodyState = { progress: 0 };

  overlay.setLeadPath(getHiddenBottomPath());
  overlay.setBodyPath(getHiddenBottomPath());

  tl.to(
    leadState,
    {
      progress: 1,
      duration: 0.68,
      ease: "power4.inOut",
      onUpdate: () => {
        overlay.setLeadPath(calculateSweepInPath(leadState.progress, 1.25));
      },
    },
    0.02,
  );

  tl.to(
    bodyState,
    {
      progress: 1,
      duration: 0.68,
      ease: "power4.inOut",
      onUpdate: () => {
        overlay.setBodyPath(calculateSweepInPath(bodyState.progress, 0.95));
      },
    },
    0.08,
  );
};

export const initIncomingFluidWipe = (): void => {
  try {
    if (sessionStorage.getItem(STORAGE_PENDING_KEY) === "true") {
      sessionStorage.removeItem(STORAGE_PENDING_KEY);
      void playFluidSweepOut();
    } else {
      isTransitioning = false;
    }
  } catch {
    isTransitioning = false;
  }
};

if (typeof document !== "undefined") {
  document.addEventListener("astro:after-swap", () => {
    try {
      if (sessionStorage.getItem(STORAGE_PENDING_KEY) !== "true") {
        isTransitioning = false;
      }
    } catch {
      isTransitioning = false;
    }
  });
}
