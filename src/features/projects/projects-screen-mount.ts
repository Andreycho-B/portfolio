import { getAudioSystem } from "../../core/audio";
import { getCursorController } from "../../design-system/components/cursor-controller";
import {
  initIncomingFluidWipe,
  isModifiedClick,
  navigateWithFluidWipe,
} from "../transitions/fluid-transition-controller";
import type { DrumWebGLHandle } from "./drum.types";
import { playDrumIntroAnimation } from "./drum-intro-animation";
import { initEmailCopy } from "./email-copy";
import { LogoMagneticController } from "./logo-magnetic-fx";
import { getProjectBySlug } from "./project-data";
import { ProjectDrumController } from "./project-drum-controller";
import { ProjectTitleMorphController } from "./project-title-morph";
import { initSoundToggle } from "./sound-toggle";

let prewarmedScenePromise: Promise<DrumWebGLHandle | null> | null = null;
let prewarmedScene: DrumWebGLHandle | null = null;
let activeDrumController: ProjectDrumController | null = null;

const prewarmScene = async (canvas: HTMLCanvasElement): Promise<DrumWebGLHandle | null> => {
  try {
    const { createDrumWebGLScene } = await import("./drum-webgl-scene");
    const scene = createDrumWebGLScene(
      canvas,
      () => activeDrumController?.requestFrame(),
      (err) => {
        console.warn("[ProjectsMount] WebGL fallback triggered:", err);
        document
          .querySelector<HTMLElement>("[data-projects-section]")
          ?.classList.add("has-webgl-fallback");
      },
    );
    if (!scene) return null;
    scene.resize(
      canvas.clientWidth || window.innerWidth,
      canvas.clientHeight || window.innerHeight,
    );
    scene.render();
    return scene;
  } catch (err) {
    console.warn("[ProjectsMount] WebGL load error:", err);
    return null;
  }
};

const initProjectsSection = async (
  sceneInput?: Promise<DrumWebGLHandle | null> | DrumWebGLHandle | null,
): Promise<((soundEnabled: boolean) => void) | null> => {
  const root = document.querySelector<HTMLElement>("[data-projects-section]");
  if (!root || root.dataset.initialized === "true") return null;

  const viewport = root.querySelector<HTMLElement>("[data-drum-viewport]");
  const canvas = root.querySelector<HTMLCanvasElement>("[data-drum-canvas]");
  const titleElement = root.querySelector<HTMLElement>("[data-project-title]");
  const blurNode = document.getElementById(
    "project-title-blur-node",
  ) as SVGFEGaussianBlurElement | null;
  const morphController = ProjectTitleMorphController.fromRoot(root);

  if (!viewport || !canvas || !titleElement || !morphController) return null;

  const webglScene =
    sceneInput instanceof Promise ? await sceneInput : (sceneInput ?? (await prewarmScene(canvas)));

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
      navigateWithFluidWipe({
        targetUrl: `/proyectos/${morphController.activeSlug}`,
        canvas,
        titleElement,
      });
    },
  });
  activeDrumController = drumController;

  const cleanupSoundToggle = initSoundToggle(root);
  const cleanupEmailCopy = initEmailCopy(root);
  const logoMagnetic = LogoMagneticController.fromRoot(root);
  const aboutLink = root.querySelector<HTMLAnchorElement>("[data-about-trigger]");
  const handleAboutClick = (e: MouseEvent) => {
    if (!isModifiedClick(e)) {
      e.preventDefault();
      navigateWithFluidWipe({ targetUrl: "/sobre-mi", canvas, titleElement });
    }
  };
  aboutLink?.addEventListener("click", handleAboutClick);
  root.dataset.initialized = "true";

  document.addEventListener(
    "astro:before-swap",
    () => {
      aboutLink?.removeEventListener("click", handleAboutClick);
      logoMagnetic?.destroy();
      cleanupSoundToggle();
      cleanupEmailCopy();
      drumController.destroy();
      activeDrumController = null;
    },
    { once: true },
  );

  return (soundEnabled: boolean) =>
    playDrumIntroAnimation(
      {
        root,
        canvas,
        titleElement,
        blurNode,
        onSettleDrum: () => drumController.playIntroSettling(-1.2),
        onUpdateIntroProgress: (progress: number) => {
          webglScene?.setIntroProgress(progress);
          drumController.requestFrame();
        },
        onPlayArrivalSound: () => getAudioSystem().playProjectArrivalSound(),
      },
      soundEnabled,
    );
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
    void initProjectsSection().then((triggerIntro) => triggerIntro?.(false));
    return;
  }

  let isTriggered = false;
  if (canvas && !prewarmedScenePromise) {
    const execute = () => {
      if (!prewarmedScenePromise && !isTriggered) {
        prewarmedScenePromise = prewarmScene(canvas).then((scene) => {
          prewarmedScene = scene;
          return scene;
        });
      }
    };
    if ("requestIdleCallback" in window) window.requestIdleCallback(execute);
    else setTimeout(execute, 300);
  }

  const handleReveal = async (event: Event) => {
    if (isTriggered) return;
    isTriggered = true;
    const soundEnabled = (event as CustomEvent<{ soundEnabled?: boolean }>).detail?.soundEnabled;
    const triggerIntro = await initProjectsSection(prewarmedScene ?? prewarmedScenePromise);
    prewarmedScene = null;
    prewarmedScenePromise = null;
    triggerIntro?.(soundEnabled ?? false);
  };

  for (const evt of ["consent:reveal", "consent:completed"] as const) {
    document.addEventListener(evt, handleReveal);
  }
  document.addEventListener(
    "astro:before-swap",
    () => {
      for (const evt of ["consent:reveal", "consent:completed"] as const) {
        document.removeEventListener(evt, handleReveal);
      }
      if (prewarmedScene && !activeDrumController) {
        prewarmedScene.dispose();
        prewarmedScene = null;
      }
    },
    { once: true },
  );
};
