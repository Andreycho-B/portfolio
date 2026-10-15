import type * as THREE from "three";
import type { PostPipeline } from "./helix-postfx";

const QUALITY_WINDOW_MIN_FRAMES = 12;
const QUALITY_WINDOW_MS = 250;
const DEGRADE_BELOW_FPS = 55;
const RECOVER_ABOVE_FPS = 58;
const DEGRADED_MAX_PIXEL_RATIO = 1.0;
// Doble ventana de confirmación + cooldown entre conmutaciones: evita el
// "pumping" del tier (pixelRatio 2↔1) cuando el FPS oscila alrededor del umbral
const SWITCH_CONFIRM_WINDOWS = 2;
const SWITCH_COOLDOWN_MS = 2000;

type HelixQualityDeps = {
  readonly renderer: THREE.WebGLRenderer;
  readonly pipeline: PostPipeline;
  readonly getViewportSize: () => { readonly width: number; readonly height: number };
  readonly highPixelRatioCap: number;
  readonly setArtAlphaToCoverage: (enabled: boolean) => void;
  readonly onQualityChange: () => void;
};

export type HelixQualityGovernor = {
  readonly sampleFrame: (deltaMs: number) => void;
};

export const createHelixQualityGovernor = (deps: HelixQualityDeps): HelixQualityGovernor => {
  let degraded = false;
  let windowFrames = 0;
  let windowTimeMs = 0;
  let pendingSwitchWindows = 0;
  let lastSwitchTimeMs = 0;

  const apply = (nextDegraded: boolean): void => {
    degraded = nextDegraded;
    lastSwitchTimeMs = performance.now();
    const pixelRatioCap = degraded ? DEGRADED_MAX_PIXEL_RATIO : deps.highPixelRatioCap;
    deps.renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap));
    deps.pipeline.setDegraded(degraded);
    deps.setArtAlphaToCoverage(!degraded);
    const viewport = deps.getViewportSize();
    deps.renderer.setSize(viewport.width, viewport.height, false);
    deps.pipeline.resize(viewport.width, viewport.height);
    deps.onQualityChange();
  };

  return {
    sampleFrame: (deltaMs: number): void => {
      windowFrames += 1;
      windowTimeMs += deltaMs;
      if (windowFrames < QUALITY_WINDOW_MIN_FRAMES || windowTimeMs < QUALITY_WINDOW_MS) return;
      const fps = (windowFrames * 1000) / windowTimeMs;
      windowFrames = 0;
      windowTimeMs = 0;
      const wantsSwitch = degraded ? fps > RECOVER_ABOVE_FPS : fps < DEGRADE_BELOW_FPS;
      if (!wantsSwitch) {
        pendingSwitchWindows = 0;
        return;
      }
      pendingSwitchWindows += 1;
      if (pendingSwitchWindows < SWITCH_CONFIRM_WINDOWS) return;
      if (performance.now() - lastSwitchTimeMs < SWITCH_COOLDOWN_MS) return;
      apply(!degraded);
      pendingSwitchWindows = 0;
    },
  };
};
