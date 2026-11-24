import { getAudioSystem } from "../../core/audio";
import { getStudioTvBridge } from "../../core/tv-portal-bridge";
import { getCursorController } from "../../design-system/components/cursor-controller";
import { initIncomingFluidWipe } from "../transitions/fluid-transition-controller";
import type { StudioSceneHandle } from "./studio.types";
import type { StudioController } from "./studio-controller";
import { createStudioPreloader, type StudioPreloaderHandle } from "./studio-preloader";

let activeStudioController: StudioController | null = null;

const activateWebGLFallback = (root: HTMLElement | null): void => {
  if (!root) return;
  root.classList.add("has-webgl-fallback");
  const fallback = root.querySelector<HTMLElement>("[data-drum-fallback]");
  if (!fallback) return;
  fallback.removeAttribute("aria-hidden");
  for (const card of fallback.querySelectorAll<HTMLAnchorElement>(".fallback-card")) {
    card.removeAttribute("tabindex");
  }
};

const loadStudioController = async (): Promise<typeof import("./studio-controller") | null> => {
  try {
    return await import("./studio-controller");
  } catch (err) {
    console.warn("[ProjectsMount] Studio controller load error:", err);
    return null;
  }
};

const loadStudioScene = async (canvas: HTMLCanvasElement): Promise<StudioSceneHandle | null> => {
  try {
    const { createStudioWebGLScene } = await import("./studio-webgl-scene");
    const scene = createStudioWebGLScene(
      canvas,
      (err) => {
        console.warn("[ProjectsMount] Studio WebGL fallback triggered:", err);
        activateWebGLFallback(document.querySelector<HTMLElement>("[data-projects-section]"));
      },
      () => activeStudioController?.requestFrame(),
    );
    if (!scene) return null;
    scene.resize(
      canvas.clientWidth || window.innerWidth,
      canvas.clientHeight || window.innerHeight,
    );
    return scene;
  } catch (err) {
    console.warn("[ProjectsMount] Studio WebGL load error:", err);
    return null;
  }
};

const nextAnimationFrame = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const runConstructEntry = (
  root: HTMLElement,
  canvas: HTMLCanvasElement | null,
  preloader: StudioPreloaderHandle | null,
  soundEnabled: boolean,
): (() => void) => {
  let cancelled = false;
  let loadedScene: StudioSceneHandle | null = null;

  const cancel = (): void => {
    cancelled = true;
    preloader?.dispose();
    if (loadedScene && !activeStudioController) {
      loadedScene.dispose();
      loadedScene = null;
    }
  };

  void (async () => {
    await nextAnimationFrame();
    if (cancelled) return;
    const [studioScene, studioCtrlMod] = await Promise.all([
      canvas ? loadStudioScene(canvas) : Promise.resolve(null),
      canvas ? loadStudioController() : Promise.resolve(null),
    ]);
    if (cancelled) {
      studioScene?.dispose();
      return;
    }
    loadedScene = studioScene;

    if (!studioScene || !canvas || !studioCtrlMod) {
      studioScene?.dispose();
      loadedScene = null;
      activateWebGLFallback(root);
      await preloader?.finishAndReveal(() => {
        root.hidden = false;
      });
      return;
    }

    const unsub = studioScene.onLoadProgress((state) => preloader?.update(state));
    await studioScene.whenReady();
    unsub();
    if (cancelled) {
      studioScene.dispose();
      return;
    }

    if (root.dataset.initialized === "true") return;
    const controller = new studioCtrlMod.StudioController(canvas, studioScene, Boolean(preloader));
    activeStudioController = controller;
    root.dataset.initialized = "true";

    document.addEventListener(
      "astro:before-swap",
      () => {
        controller.destroy();
        activeStudioController = null;
      },
      { once: true },
    );

    // Promote the WebGL2 canvas layer and paint the intro start pose while still behind opaque 100.
    studioScene.playIntroOrbit();
    root.hidden = false;
    canvas.style.opacity = "1";
    studioScene.render();

    const startIntroReveal = (): void => {
      controller.playIntroSettling(-1.2);
      if (soundEnabled) getAudioSystem().playProjectArrivalSound();
      controller.requestFrame();
    };

    if (preloader) await preloader.finishAndReveal(startIntroReveal);
    else startIntroReveal();
  })();

  return cancel;
};

export const mountProjectsScreen = (): void => {
  const tvBridge = getStudioTvBridge();
  if (tvBridge) {
    tvBridge.closeToDrum();
    return;
  }
  const root = document.querySelector<HTMLElement>("[data-projects-section]");
  if (!root) return;

  const cursor = getCursorController();
  cursor.setExpanded(false);
  cursor.setPressed(false);
  cursor.setInverted(false);
  initIncomingFluidWipe();

  const canvas = root.querySelector<HTMLCanvasElement>("[data-drum-canvas]");
  const preloaderEl = document.querySelector<HTMLElement>("[data-studio-preloader]");
  const consentScreen = document.querySelector<HTMLElement>("[data-consent-screen]");
  const isSkipConsent =
    !consentScreen ||
    consentScreen.style.display === "none" ||
    document.documentElement.classList.contains("skip-consent");

  if (isSkipConsent) {
    const preloader = createStudioPreloader(preloaderEl);
    const cancelEntry = runConstructEntry(root, canvas, preloader, false);
    document.addEventListener("astro:before-swap", cancelEntry, { once: true });
    return;
  }

  let preloader: StudioPreloaderHandle | null = null;
  let isLoadingStarted = false;
  let cancelEntry: (() => void) | null = null;

  const handleReveal = (): void => {
    preloader ??= createStudioPreloader(preloaderEl);
  };

  const handleCompleted = (event: Event): void => {
    if (isLoadingStarted) return;
    isLoadingStarted = true;
    preloader ??= createStudioPreloader(preloaderEl);
    const soundEnabled = (event as CustomEvent<{ soundEnabled?: boolean }>).detail?.soundEnabled;
    cancelEntry = runConstructEntry(root, canvas, preloader, soundEnabled ?? false);
  };

  document.addEventListener("consent:reveal", handleReveal);
  document.addEventListener("consent:completed", handleCompleted);
  document.addEventListener(
    "astro:before-swap",
    () => {
      document.removeEventListener("consent:reveal", handleReveal);
      document.removeEventListener("consent:completed", handleCompleted);
      if (cancelEntry) cancelEntry();
      else preloader?.dispose();
    },
    { once: true },
  );
};
