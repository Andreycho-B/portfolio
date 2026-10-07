import { gsap } from "gsap";
import { getAudioSystem } from "../../core/audio";
import { getCursorController } from "../../design-system/components/cursor-controller";
import { initCloudCanvas } from "../welcome/cloud-controller";
import { initWelcomeBackdrop } from "../welcome/welcome-backdrop";

export const initConsentScreen = (): void => {
  const screenElement = document.querySelector<HTMLElement>("[data-consent-screen]");
  const contentElement = document.querySelector<HTMLElement>("[data-consent-content]");
  const promptElement = document.querySelector<HTMLElement>("[data-consent-prompt]");
  const actionsElement = document.querySelector<HTMLElement>("[data-consent-actions]");
  const muteButton = document.querySelector<HTMLButtonElement>("[data-btn-mute]");
  const cloudCanvas = screenElement?.querySelector<HTMLCanvasElement>("[data-cloud-canvas]");

  if (!screenElement || !contentElement || !promptElement || !actionsElement) {
    return;
  }

  const backdrop = initWelcomeBackdrop(screenElement);
  const cloud = cloudCanvas ? initCloudCanvas(cloudCanvas) : null;
  const audio = getAudioSystem();
  const cursor = getCursorController();
  let isTransitioning = false;
  let isRevealed = false;

  const handlePointerMove = (event: PointerEvent) => {
    if (!isRevealed || isTransitioning) return;
    const target = event.target instanceof Element ? event.target : null;
    const isMute = target?.closest("[data-btn-mute]");

    if (isMute) {
      cursor.setMuted(true);
    } else {
      cursor.setMuted(false);
      cursor.setExpanded(true, "Entrar");
    }
  };

  const handlePointerDown = () => {
    if (isRevealed && !isTransitioning) cursor.setPressed(true);
  };

  const handlePointerUp = () => {
    cursor.setPressed(false);
  };

  const handleScreenClick = (event: MouseEvent) => {
    if (!isRevealed || isTransitioning) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("[data-btn-mute]")) return; // Manejado por muteButton click
    executeGravitationalCollapse(true);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && isRevealed && !isTransitioning) {
      if (document.activeElement === muteButton) {
        executeGravitationalCollapse(false);
        return;
      }
      executeGravitationalCollapse(true);
    }
  };

  const handleMuteEnter = () => cursor.setMuted(true);
  const handleMuteLeave = () => {
    cursor.setMuted(false);
    cursor.setExpanded(true, "Entrar");
  };
  const handleMuteClick = (event: MouseEvent) => {
    event.stopPropagation();
    executeGravitationalCollapse(false);
  };

  const cleanupListeners = () => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerdown", handlePointerDown);
    window.removeEventListener("pointerup", handlePointerUp);
    screenElement.removeEventListener("click", handleScreenClick);
    if (muteButton) {
      muteButton.removeEventListener("pointerenter", handleMuteEnter);
      muteButton.removeEventListener("pointerleave", handleMuteLeave);
      muteButton.removeEventListener("click", handleMuteClick);
    }
  };

  const executeGravitationalCollapse = (enableSound: boolean) => {
    if (isTransitioning) return;
    isTransitioning = true;
    cleanupListeners();
    cursor.disable();

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(12);
      } catch {
        // Ignorar si el dispositivo no soporta vibración
      }
    }

    if (enableSound) {
      void audio.initialize(true).then((isActive) => {
        if (isActive) audio.playReleaseSound();
      });
    } else {
      void audio.initialize(false);
    }

    const tl = gsap.timeline({
      onComplete: () => {
        backdrop?.destroy();
        cloud?.destroy();
        screenElement.dispatchEvent(
          new CustomEvent("consent:completed", {
            bubbles: true,
            detail: { soundEnabled: enableSound },
          }),
        );
      },
    });

    tl.to(contentElement, {
      yPercent: -55,
      scaleX: 1,
      scaleY: 1,
      duration: 0.6,
      ease: "power1.inOut",
      transformOrigin: "50% 0%",
      force3D: true,
    });

    tl.to(contentElement, {
      yPercent: -125,
      scaleY: 0.01,
      scaleX: 2.4,
      opacity: 0,
      duration: 0.8,
      ease: "power2.inOut",
      transformOrigin: "50% 0%",
      force3D: true,
    });

    gsap.to(actionsElement, { opacity: 0, duration: 0.45, ease: "power2.out", force3D: true });
    if (cloudCanvas) gsap.to(cloudCanvas, { opacity: 0, duration: 0.45, ease: "power2.out" });
  };

  const revealControls = () => {
    isRevealed = true;
    promptElement.classList.add("is-revealed");
    actionsElement.classList.add("is-revealed");
    cursor.enable();
    cursor.setExpanded(true, "Entrar");
  };

  screenElement.addEventListener("morphic:complete", revealControls, { once: true });

  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("pointerdown", handlePointerDown);
  window.addEventListener("pointerup", handlePointerUp);
  window.addEventListener("keydown", handleKeyDown);
  screenElement.addEventListener("click", handleScreenClick);

  if (muteButton) {
    muteButton.addEventListener("pointerenter", handleMuteEnter);
    muteButton.addEventListener("pointerleave", handleMuteLeave);
    muteButton.addEventListener("click", handleMuteClick);
  }

  document.addEventListener(
    "astro:before-swap",
    () => {
      cleanupListeners();
      cursor.destroy();
      backdrop?.destroy();
      cloud?.destroy();
    },
    { once: true },
  );
};
