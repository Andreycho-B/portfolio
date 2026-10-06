import { gsap } from "gsap";
import { getAudioSystem } from "../../core/audio";
import { createScrollTension } from "./scroll-tension";

export const initConsentScreen = (): void => {
  const screenElement = document.querySelector<HTMLElement>("[data-consent-screen]");
  const contentElement = document.querySelector<HTMLElement>("[data-consent-content]");
  const promptElement = document.querySelector<HTMLElement>("[data-consent-prompt]");
  const actionsElement = document.querySelector<HTMLElement>("[data-consent-actions]");
  const barElement = document.querySelector<HTMLElement>("[data-tension-bar]");
  const muteButton = document.querySelector<HTMLButtonElement>("[data-btn-mute]");

  if (!screenElement || !contentElement || !promptElement || !actionsElement || !barElement) {
    return;
  }

  const audio = getAudioSystem();
  let isTransitioning = false;

  const executeGravitationalCollapse = (enableSound: boolean) => {
    if (isTransitioning) return;
    isTransitioning = true;
    tensionController.disable();

    if (enableSound) {
      audio.initialize(true).then(() => {
        audio.playReleaseSound();
      });
    } else {
      audio.initialize(false);
    }

    // Colapso gravitacional hacia el punto medio izquierdo (§7 del spec)
    gsap.to(contentElement, {
      scale: 0.15,
      xPercent: -45,
      opacity: 0,
      duration: 0.95,
      ease: "power3.in",
      onComplete: () => {
        screenElement.dispatchEvent(
          new CustomEvent("consent:completed", {
            bubbles: true,
            detail: { soundEnabled: enableSound },
          }),
        );
      },
    });

    gsap.to(actionsElement, { opacity: 0, duration: 0.3 });
  };

  const tensionController = createScrollTension(screenElement, {
    onProgress: (progress) => {
      barElement.style.transform = `scaleX(${progress})`;
      contentElement.style.transform = `translateY(-${progress * 28}px) scale(${1 - progress * 0.04})`;
    },
    onTrigger: () => {
      executeGravitationalCollapse(true);
    },
    onReset: () => {
      barElement.style.transform = "scaleX(0)";
      contentElement.style.transform = "none";
    },
  });

  const revealControls = () => {
    promptElement.classList.add("is-revealed");
    actionsElement.classList.add("is-revealed");
    tensionController.enable();
  };

  screenElement.addEventListener("morphic:complete", revealControls, { once: true });

  muteButton?.addEventListener("click", () => {
    executeGravitationalCollapse(false);
  });

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !isTransitioning) {
      executeGravitationalCollapse(true);
    }
  };
  window.addEventListener("keydown", handleKeyDown);

  document.addEventListener(
    "astro:before-swap",
    () => {
      tensionController.destroy();
      window.removeEventListener("keydown", handleKeyDown);
    },
    { once: true },
  );
};
