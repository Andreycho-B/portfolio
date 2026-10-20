import { getAudioSystem } from "../../core/audio";
import { getCursorController } from "../../design-system/components/cursor-controller";
import { initIncomingFluidWipe } from "../transitions/fluid-transition-controller";
import type { DrumWebGLHandle } from "./drum.types";
import { playDrumIntroAnimation } from "./drum-intro-animation";
import { navigateWithCurtain } from "./drum-transition";
import { initEmailCopy } from "./email-copy";
import { LogoMagneticController } from "./logo-magnetic-fx";
import { getProjectBySlug } from "./project-data";
import { ProjectDrumController } from "./project-drum-controller";
import { ProjectTitleMorphController } from "./project-title-morph";
import { initSoundToggle } from "./sound-toggle";

let prewarmedScenePromise: Promise<DrumWebGLHandle | null> | null = null;
let prewarmedScene: DrumWebGLHandle | null = null;
let activeDrumController: ProjectDrumController | null = null;

const loadDrumSceneModule = () => import("./drum-webgl-scene");

const prewarmScene = async (canvas: HTMLCanvasElement): Promise<DrumWebGLHandle | null> => {
  try {
    const { createDrumWebGLScene } = await loadDrumSceneModule();
    const scene = createDrumWebGLScene(
      canvas,
      () => activeDrumController?.invalidate(),
      (err) => {
        console.warn("[ProjectsMount] WebGL fallback triggered:", err);
        const root = document.querySelector<HTMLElement>("[data-projects-section]");
        root?.classList.add("has-webgl-fallback");
      },
    );
    if (!scene) return null;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    scene.resize(width, height);
    scene.render();
    return scene;
  } catch (err) {
    console.warn("[ProjectsMount] WebGL load error:", err);
    return null;
  }
};

export const initProjectsSection = async (
  sceneInput?: Promise<DrumWebGLHandle | null> | DrumWebGLHandle | null,
): Promise<((soundEnabled: boolean) => void) | null> => {
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

  let webglScene: DrumWebGLHandle | null = null;
  if (sceneInput instanceof Promise) {
    webglScene = await sceneInput;
  } else if (sceneInput) {
    webglScene = sceneInput;
  } else {
    webglScene = await prewarmScene(canvas);
  }

  const drumController = new ProjectDrumController({
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
  const handleAboutClick = (e: MouseEvent) => {
    e.preventDefault();
    navigateWithCurtain({
      targetUrl: "/sobre-mi",
      canvas,
      titleElement,
    });
  };
  aboutLink?.addEventListener("click", handleAboutClick);

  root.dataset.initialized = "true";

  const cleanup = () => {
    aboutLink?.removeEventListener("click", handleAboutClick);
    logoMagnetic?.destroy();
    cleanupSoundToggle();
    cleanupEmailCopy();
    drumController.destroy();
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
        onSettleDrum: () => drumController.playIntroSettling(-1.2),
        onUpdateIntroProgress: (progress: number) => {
          webglScene?.setIntroProgress(progress);
          drumController.invalidate();
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

  const cursor = getCursorController();
  cursor.setExpanded(false);
  cursor.setPressed(false);
  cursor.setInverted(false);

  initIncomingFluidWipe();
  const canvas = root.querySelector<HTMLCanvasElement>("[data-drum-canvas]");
  const consentScreen = document.querySelector<HTMLElement>("[data-consent-screen]");
  if (
    !consentScreen ||
    consentScreen.style.display === "none" ||
    document.documentElement.classList.contains("skip-consent")
  ) {
    void initProjectsSection().then((triggerIntro) => {
      if (triggerIntro) triggerIntro(false);
    });
    return;
  }

  let isTriggered = false;

  const schedulePrewarm = () => {
    if (!canvas || prewarmedScenePromise) return;
    const execute = () => {
      if (!prewarmedScenePromise && !isTriggered) {
        prewarmedScenePromise = prewarmScene(canvas).then((scene) => {
          prewarmedScene = scene;
          return scene;
        });
      }
    };
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      window.requestIdleCallback(execute);
    } else {
      setTimeout(execute, 300);
    }
  };

  schedulePrewarm();

  const handleReveal = async (event: Event) => {
    if (isTriggered) return;
    isTriggered = true;
    const customEvent = event as CustomEvent<{ soundEnabled?: boolean }>;
    const soundEnabled = customEvent.detail?.soundEnabled ?? false;
    const triggerIntro = await initProjectsSection(prewarmedScene ?? prewarmedScenePromise);
    prewarmedScene = null;
    prewarmedScenePromise = null;
    if (triggerIntro) {
      triggerIntro(soundEnabled);
    }
  };

  document.addEventListener("consent:reveal", handleReveal);
  document.addEventListener("consent:completed", handleReveal);

  const handleSwap = () => {
    document.removeEventListener("consent:reveal", handleReveal);
    document.removeEventListener("consent:completed", handleReveal);
    if (prewarmedScene && !activeDrumController) {
      prewarmedScene.dispose();
      prewarmedScene = null;
    }
    document.removeEventListener("astro:before-swap", handleSwap);
  };
  document.addEventListener("astro:before-swap", handleSwap, { once: true });
};
