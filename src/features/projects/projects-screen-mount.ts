import { getAudioSystem } from "../../core/audio";
import { getCursorController } from "../../design-system/components/cursor-controller";
import { initIncomingFluidWipe } from "../transitions/fluid-transition-controller";
import { playDrumIntroAnimation } from "./drum-intro-animation";
import { navigateWithCurtain } from "./drum-transition";
import { createDrumWebGLScene, type DrumWebGLHandle } from "./drum-webgl-scene";
import { initEmailCopy } from "./email-copy";
import { LogoMagneticController } from "./logo-magnetic-fx";
import { getProjectBySlug } from "./project-data";
import { ProjectDrumController } from "./project-drum-controller";
import { ProjectTitleMorphController } from "./project-title-morph";
import { initSoundToggle } from "./sound-toggle";

let prewarmedScene: DrumWebGLHandle | null = null;
let activeDrumController: ProjectDrumController | null = null;

const prewarmScene = (canvas: HTMLCanvasElement): DrumWebGLHandle => {
  const scene = createDrumWebGLScene(canvas, () => activeDrumController?.invalidate());
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  scene.resize(width, height);
  scene.render();
  return scene;
};

export const initProjectsSection = (
  existingScene?: DrumWebGLHandle | null,
): ((soundEnabled: boolean) => void) | null => {
  const root = document.querySelector<HTMLElement>("[data-projects-section]");
  if (!root || root.dataset.initialized === "true") return null;

  const viewport = root.querySelector<HTMLElement>("[data-drum-viewport]");
  const canvas = root.querySelector<HTMLCanvasElement>("[data-drum-canvas]");
  const titleElement = root.querySelector<HTMLElement>("[data-project-title]");
  const yearElement = root.querySelector<HTMLElement>("[data-project-year]");
  const currentIdxElement = root.querySelector<HTMLElement>("[data-project-index]");
  const thumbBarElement = root.querySelector<HTMLElement>("[data-drum-thumb]");
  const blurNode = document.getElementById(
    "project-title-blur-node",
  ) as SVGFEGaussianBlurElement | null;

  if (!viewport || !canvas || !titleElement || !yearElement || !currentIdxElement) {
    return null;
  }

  const morphController = new ProjectTitleMorphController({
    titleElement,
    yearElement,
    currentIdxElement,
    thumbBarElement,
    blurNode,
  });

  let drumController: ProjectDrumController | null = null;
  const webglScene =
    existingScene ?? createDrumWebGLScene(canvas, () => drumController?.invalidate());

  drumController = new ProjectDrumController({
    root,
    viewport,
    canvas,
    morphController,
    webglScene,
    onOpenActive: () => {
      const activeProj = getProjectBySlug(morphController.activeSlug);
      if (activeProj?.externalUrl) {
        window.open(activeProj.externalUrl, "_blank", "noopener,noreferrer");
        return;
      }
      navigateWithCurtain({
        targetUrl: `/proyectos/${morphController.activeSlug}`,
        canvas,
        titleElement,
      });
    },
  });
  activeDrumController = drumController;

  const cleanupSoundToggle = initSoundToggle(root);
  const cleanupEmailCopy = initEmailCopy(root);
  const brandLockup = root.querySelector<HTMLElement>(".brand-lockup");
  const brandMonogram = root.querySelector<HTMLElement>(".brand-monogram");
  const logoMagnetic =
    brandLockup && brandMonogram
      ? new LogoMagneticController({ trigger: brandLockup, target: brandMonogram })
      : null;

  const aboutLink = root.querySelector<HTMLAnchorElement>("[data-about-trigger]");
  if (aboutLink) {
    aboutLink.addEventListener("click", (e) => {
      e.preventDefault();
      navigateWithCurtain({
        targetUrl: "/sobre-mi",
        canvas,
        titleElement,
      });
    });
  }

  root.dataset.initialized = "true";

  const cleanup = () => {
    logoMagnetic?.destroy();
    cleanupSoundToggle();
    cleanupEmailCopy();
    drumController?.destroy();
    activeDrumController = null;
    document.removeEventListener("astro:before-swap", cleanup);
  };
  document.addEventListener("astro:before-swap", cleanup, { once: true });

  return (soundEnabled: boolean) => {
    const audio = getAudioSystem();
    playDrumIntroAnimation(
      {
        root,
        canvas,
        metaBar: root.querySelector<HTMLElement>(".projects-meta-bar"),
        titleElement,
        detailsRow: root.querySelector<HTMLElement>(".project-details-row"),
        pagination: root.querySelector<HTMLElement>(".drum-pagination"),
        actionColumn: root.querySelector<HTMLElement>(".project-action-column"),
        blurNode,
        onSettleDrum: () => drumController?.playIntroSettling(-1.2),
        onUpdateIntroProgress: (progress: number) => {
          webglScene.setIntroProgress(progress);
          drumController?.invalidate();
        },
        onPlayArrivalSound: () => audio.playProjectArrivalSound(),
      },
      soundEnabled,
    );
  };
};

export const mountProjectsScreen = (): void => {
  const root = document.querySelector<HTMLElement>("[data-projects-section]");
  if (!root) return;

  try {
    const cursor = getCursorController();
    cursor.setExpanded(false);
    cursor.setPressed(false);
    cursor.setInverted(false);
  } catch {}

  initIncomingFluidWipe();
  const canvas = root.querySelector<HTMLCanvasElement>("[data-drum-canvas]");
  const consentScreen = document.querySelector<HTMLElement>("[data-consent-screen]");
  if (
    !consentScreen ||
    consentScreen.style.display === "none" ||
    document.documentElement.classList.contains("skip-consent")
  ) {
    const triggerIntro = initProjectsSection();
    if (triggerIntro) triggerIntro(false);
    return;
  }

  let isTriggered = false;

  const schedulePrewarm = () => {
    if (!canvas || prewarmedScene) return;
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      window.requestIdleCallback(() => {
        if (!prewarmedScene && !isTriggered) {
          prewarmedScene = prewarmScene(canvas);
        }
      });
    } else {
      setTimeout(() => {
        if (!prewarmedScene && !isTriggered) {
          prewarmedScene = prewarmScene(canvas);
        }
      }, 300);
    }
  };

  schedulePrewarm();

  const handleReveal = (event: Event) => {
    if (isTriggered) return;
    isTriggered = true;
    const customEvent = event as CustomEvent<{ soundEnabled?: boolean }>;
    const soundEnabled = customEvent.detail?.soundEnabled ?? false;
    const triggerIntro = initProjectsSection(prewarmedScene);
    prewarmedScene = null;
    if (triggerIntro) {
      triggerIntro(soundEnabled);
    }
  };

  document.addEventListener("consent:reveal", handleReveal);
  document.addEventListener("consent:completed", handleReveal);

  const handleSwap = () => {
    if (prewarmedScene && !activeDrumController) {
      prewarmedScene.dispose();
      prewarmedScene = null;
    }
    document.removeEventListener("astro:before-swap", handleSwap);
  };
  document.addEventListener("astro:before-swap", handleSwap, { once: true });
};
