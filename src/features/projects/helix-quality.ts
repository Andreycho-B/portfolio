import type * as THREE from "three";
import type { PostPipeline } from "./helix-postfx";

const QUALITY_WINDOW_FRAMES = 60;
const DEGRADE_BELOW_FPS = 55;
const RECOVER_ABOVE_FPS = 58;
const DEGRADED_MAX_PIXEL_RATIO = 1.5;

type HelixQualityDeps = {
  readonly renderer: THREE.WebGLRenderer;
  readonly pipeline: PostPipeline;
  readonly getViewportSize: () => { readonly width: number; readonly height: number };
  readonly highPixelRatioCap: number;
  readonly onQualityChange: () => void;
};

export type HelixQualityGovernor = {
  readonly sampleFrame: (deltaMs: number) => void;
};

export const createHelixQualityGovernor = (deps: HelixQualityDeps): HelixQualityGovernor => {
  let degraded = false;
  let windowFrames = 0;
  let windowTimeMs = 0;

  const apply = (nextDegraded: boolean): void => {
    degraded = nextDegraded;
    const pixelRatioCap = degraded ? DEGRADED_MAX_PIXEL_RATIO : deps.highPixelRatioCap;
    deps.renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap));
    deps.pipeline.setDegraded(degraded);
    const viewport = deps.getViewportSize();
    deps.renderer.setSize(viewport.width, viewport.height, false);
    deps.pipeline.resize(viewport.width, viewport.height);
    deps.onQualityChange();
  };

  return {
    sampleFrame: (deltaMs: number): void => {
      windowFrames += 1;
      windowTimeMs += deltaMs;
      if (windowFrames < QUALITY_WINDOW_FRAMES) return;
      const fps = (windowFrames * 1000) / windowTimeMs;
      windowFrames = 0;
      windowTimeMs = 0;
      if (!degraded && fps < DEGRADE_BELOW_FPS) {
        apply(true);
      } else if (degraded && fps > RECOVER_ABOVE_FPS) {
        apply(false);
      }
    },
  };
};
