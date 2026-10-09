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
  const blueBox = screenElement?.querySelector<HTMLElement>("[data-blue-box]");
  const vignette = screenElement?.querySelector<HTMLElement>(".top-blur-vignette");

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
      cursor.setExpanded(true, "Ingresar");
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
    cursor.setExpanded(true, "Ingresar");
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
    cursor.setExpanded(false);
    cursor.pulse();

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

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      cursor.setInverted(false);
      const targets = [contentElement, actionsElement, cloudCanvas, blueBox, vignette].filter(
        (el): el is HTMLElement | HTMLCanvasElement => el !== null,
      );
      gsap.to(targets, {
        opacity: 0,
        duration: 0.25,
        onComplete: () => {
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

    const line1 = contentElement.querySelector<HTMLElement>('[data-morphic-line="1"]');
    const line2 = contentElement.querySelector<HTMLElement>('[data-morphic-line="2"]');

    const tl = gsap.timeline({
      onComplete: () => {
        backdrop?.destroy();
        cloud?.destroy();
        cursor.setInverted(false);
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

    // 1. Arrastre gravitacional ascendente de controles inferiores
    tl.to(
      promptElement,
      {
        y: -24,
        opacity: 0,
        duration: 0.24,
        ease: "power2.in",
        force3D: true,
      },
      0,
    );

    tl.to(
      actionsElement,
      {
        y: -16,
        opacity: 0,
        duration: 0.24,
        ease: "power2.in",
        force3D: true,
      },
      0,
    );

    if (cloudCanvas) {
      // Degradado ascendente: la máscara vive en el CSS; GSAP solo coreografía
      // la variable --wipe-edge desde su valor de reposo (100) hasta -wipe-soft
      const wipeSoftBand = Number.parseFloat(
        getComputedStyle(cloudCanvas).getPropertyValue("--wipe-soft"),
      );
      if (Number.isFinite(wipeSoftBand)) {
        tl.to(
          cloudCanvas,
          {
            "--wipe-edge": -wipeSoftBand,
            duration: 1.8,
            ease: "power2.inOut",
          },
          0.2,
        );
      } else {
        console.warn("[ConsentScreen] Variable --wipe-soft no definida; se omite el degradado");
      }
    }

    if (vignette) {
      tl.to(
        vignette,
        {
          y: -80,
          opacity: 0,
          duration: 0.35,
          ease: "power2.in",
        },
        0.1,
      );
    }

    if (blueBox) {
      // La caja ya está cubierta por el canvas opaco: ocultarla al inicio evita
      // que su degradado eléctrico se transparente durante la salida hacia el crema
      tl.set(blueBox, { opacity: 0 }, 0);
    }

    tl.call(() => cursor.setInverted(false), undefined, 0.28);

    // 2. Micro-anticipación y compresión elástica previa
    tl.to(
      contentElement,
      {
        scale: 0.97,
        y: 8,
        duration: 0.16,
        ease: "power1.in",
        force3D: true,
      },
      0,
    );

    // 3. Succión exponencial hiperbólica con deformación y motion blur
    if (line1 && line2) {
      tl.to(
        line1,
        {
          yPercent: -135,
          scaleX: 1.8,
          scaleY: 0.04,
          opacity: 0,
          filter: "blur(8px)",
          duration: 0.52,
          ease: "expo.in",
          transformOrigin: "50% 0%",
          force3D: true,
        },
        0.16,
      );

      tl.to(
        line2,
        {
          yPercent: -135,
          scaleX: 1.9,
          scaleY: 0.03,
          opacity: 0,
          filter: "blur(10px)",
          duration: 0.52,
          ease: "expo.in",
          transformOrigin: "50% 0%",
          force3D: true,
        },
        0.175,
      );
    } else {
      tl.to(
        contentElement,
        {
          yPercent: -135,
          scaleX: 2.0,
          scaleY: 0.02,
          opacity: 0,
          filter: "blur(10px)",
          duration: 0.55,
          ease: "expo.in",
          transformOrigin: "50% 0%",
          force3D: true,
        },
        0.16,
      );
    }

    // Desvanecimiento final de seguridad del contenedor
    tl.to(
      contentElement,
      {
        opacity: 0,
        duration: 0.2,
        ease: "power2.in",
      },
      0.55,
    );
  };

  const revealControls = () => {
    isRevealed = true;
    promptElement.classList.add("is-revealed");
    actionsElement.classList.add("is-revealed");
    cursor.enable();
    cursor.setInverted(true);
    cursor.setExpanded(true, "Ingresar");
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
