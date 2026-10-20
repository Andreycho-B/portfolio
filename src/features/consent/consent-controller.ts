import { gsap } from "gsap";
import { getAudioSystem } from "../../core/audio";
import { getCursorController } from "../../design-system/components/cursor-controller";
import { initCloudCanvas } from "./cloud-controller";
import { type ConsentCollapseTargets, executeCollapseTimeline } from "./consent-collapse";
import {
  getStoredSoundPreference,
  isRecentConsent,
  saveConsentPreference,
} from "./consent-storage";
import { initWelcomeBackdrop } from "./welcome-backdrop";

const CURSOR_LABEL_CONSENT = "Ingresar";

export const initConsentScreen = (): void => {
  const screenElement = document.querySelector<HTMLElement>("[data-consent-screen]");
  const contentElement = document.querySelector<HTMLElement>("[data-consent-content]");
  const promptElement = document.querySelector<HTMLElement>("[data-consent-prompt]");
  const actionsElement = document.querySelector<HTMLElement>("[data-consent-actions]");
  const muteButton = document.querySelector<HTMLButtonElement>("[data-btn-mute]");

  if (!screenElement || !contentElement || !promptElement || !actionsElement) return;

  if (document.documentElement.classList.contains("skip-consent") || isRecentConsent()) {
    screenElement.style.display = "none";
    screenElement.style.pointerEvents = "none";
    getCursorController().enable();
    const soundEnabled = getStoredSoundPreference();
    void getAudioSystem().initialize(soundEnabled);
    screenElement.dispatchEvent(
      new CustomEvent("consent:completed", { bubbles: true, detail: { soundEnabled } }),
    );
    return;
  }

  const cloudCanvas = screenElement.querySelector<HTMLCanvasElement>("[data-cloud-canvas]");
  const blueBox = screenElement.querySelector<HTMLElement>("[data-blue-box]");
  const vignette = screenElement.querySelector<HTMLElement>(".top-blur-vignette");

  const backdrop = initWelcomeBackdrop(screenElement);
  const cloud = cloudCanvas
    ? initCloudCanvas(cloudCanvas, { contentEl: contentElement, actionsEl: actionsElement })
    : null;
  const audio = getAudioSystem();
  const cursor = getCursorController();
  const collapseTargets: ConsentCollapseTargets = {
    screenElement,
    contentElement,
    promptElement,
    actionsElement,
    cloudCanvas,
    blueBox,
    vignette,
    cursor,
    backdrop,
    cloud,
  };
  let isTransitioning = false;
  let isRevealed = false;

  const handlePointerMove = (event: PointerEvent) => {
    if (!isRevealed || isTransitioning) return;
    const target = event.target instanceof Element ? event.target : null;
    const isMute = target?.closest("[data-btn-mute]");
    if (isMute) cursor.setMuted(true);
    else {
      cursor.setMuted(false);
      cursor.setExpanded(true, CURSOR_LABEL_CONSENT);
    }
  };

  const handlePointerDown = () => isRevealed && !isTransitioning && cursor.setPressed(true);
  const handlePointerUp = () => cursor.setPressed(false);

  const handleScreenClick = (event: MouseEvent) => {
    if (!isRevealed || isTransitioning) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("[data-btn-mute]")) return;
    executeGravitationalCollapse(true);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && isRevealed && !isTransitioning) {
      executeGravitationalCollapse(document.activeElement !== muteButton);
    }
  };

  const handleMuteEnter = () => cursor.setMuted(true);
  const handleMuteLeave = () => {
    cursor.setMuted(false);
    cursor.setExpanded(true, CURSOR_LABEL_CONSENT);
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
    cursor.setMuted(false);
    cursor.pulse();

    saveConsentPreference(enableSound);

    if (enableSound) {
      void audio.initialize(true).then((ok) => ok && audio.playReleaseSound());
    } else {
      void audio.initialize(false);
    }

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      const targets = [contentElement, actionsElement, cloudCanvas, blueBox, vignette].filter(
        (el): el is HTMLElement | HTMLCanvasElement => el !== null,
      );
      gsap.to(targets, {
        opacity: 0,
        duration: 0.25,
        onComplete: () => {
          cursor.setInverted(false);
          cursor.setExpanded(false);
          backdrop?.destroy();
          cloud?.destroy();
          screenElement.style.display = "none";
          screenElement.style.pointerEvents = "none";
          screenElement.dispatchEvent(
            new CustomEvent("consent:completed", {
              bubbles: true,
              detail: { soundEnabled: enableSound },
            }),
          );
        },
      });
      return;
    }

    executeCollapseTimeline(collapseTargets, enableSound);
  };

  const revealControls = () => {
    isRevealed = true;
    promptElement.classList.add("is-revealed");
    actionsElement.classList.add("is-revealed");
    cursor.enable();
    cursor.setInverted(true);
    cursor.setExpanded(true, CURSOR_LABEL_CONSENT);
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
      backdrop?.destroy();
      cloud?.destroy();
    },
    { once: true },
  );
};
