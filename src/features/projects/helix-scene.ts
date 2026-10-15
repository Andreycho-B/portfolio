import * as THREE from "three";
import { createHelixWorld, HELIX_CONFIG } from "./helix-cards";
import type { HelixCardDatum, HelixSceneHandle } from "./helix-cards.types";
import { setupHelixEnvironment } from "./helix-environment";
import { CAMERA_FOV_DEG, frameHelix } from "./helix-framing";
import { CREME_BACKGROUND } from "./helix-materials";
import { createHelixMotion } from "./helix-motion";
import { createPostPipeline } from "./helix-postfx";
import { createHelixQualityGovernor } from "./helix-quality";

const MAX_PIXEL_RATIO = 2;

const IDLE_FRAME_LIMIT = 2;
const FRAME_GAP_MAX_MS = 200;

const CREME_BACKGROUND_COLOR = new THREE.Color(CREME_BACKGROUND);

export const createHelixScene = async (
  canvas: HTMLCanvasElement,
  cardData: readonly HelixCardDatum[],
  onContextLost?: () => void,
): Promise<HelixSceneHandle | null> => {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));

  const scene = new THREE.Scene();
  scene.background = CREME_BACKGROUND_COLOR;
  const environmentTexture = setupHelixEnvironment(scene, renderer);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 0.1, 100);
  camera.position.set(0, 2.4, 21);
  camera.lookAt(0, 0, 0);

  const world = await createHelixWorld(
    HELIX_CONFIG,
    cardData,
    renderer.capabilities.getMaxAnisotropy(),
  );
  scene.add(world.group);

  const pipeline = createPostPipeline(renderer, scene, camera, world.focusTarget);

  let animationFrameId: number | null = null;
  let running = false;
  let idleFrames = 0;
  let needsRender = true;
  let lastWidth = 1;
  let lastHeight = 1;
  let lastRenderTimeMs = performance.now();
  let contextLost = false;
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const governor = createHelixQualityGovernor({
    renderer,
    pipeline,
    getViewportSize: () => ({ width: lastWidth, height: lastHeight }),
    highPixelRatioCap: MAX_PIXEL_RATIO,
    setArtAlphaToCoverage: (enabled) => world.setArtAlphaToCoverage(enabled),
    onQualityChange: () => {
      needsRender = true;
    },
  });

  const schedule = (): void => {
    if (contextLost) return;
    needsRender = true;
    if (!running) {
      running = true;
      idleFrames = 0;
      lastRenderTimeMs = performance.now();
      animationFrameId = requestAnimationFrame(frame);
    }
  };

  const motion = createHelixMotion({
    applyToWorld: (advance, velocity, introProgress) =>
      world.setAdvance(advance, velocity, introProgress),
    requestRender: schedule,
    periodSlots: HELIX_CONFIG.cardCount,
    reducedMotion,
  });

  const scrollBy = (deltaPx: number): void => {
    if (contextLost) return;
    motion.advanceBy(deltaPx);
  };

  const scrollTo = (slots: number): void => {
    if (contextLost) return;
    motion.advanceTo(slots);
  };

  const resize = (width: number, height: number): void => {
    if (contextLost) return;
    lastWidth = width;
    lastHeight = height;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    frameHelix(camera, world.framingBox, camera.aspect);
    pipeline.resize(width, height);
    schedule();
  };

  const frame = (frameTimeMs: number): void => {
    animationFrameId = null;
    const deltaMs = Math.min(Math.max(frameTimeMs - lastRenderTimeMs, 1), FRAME_GAP_MAX_MS);
    lastRenderTimeMs = frameTimeMs;
    const dtSeconds = deltaMs / 1000;

    if (motion.tick(dtSeconds)) needsRender = true;

    if (needsRender) {
      governor.sampleFrame(deltaMs);
      pipeline.composer.render();
      needsRender = false;
      idleFrames = 0;
    } else {
      idleFrames += 1;
    }

    if (!running) return;
    if (idleFrames <= IDLE_FRAME_LIMIT) {
      animationFrameId = requestAnimationFrame(frame);
    } else {
      running = false;
    }
  };

  const start = (): void => {
    schedule();
  };

  const playIntro = (): Promise<void> => motion.playIntro();

  const handleContextLost = (event: Event): void => {
    event.preventDefault();
    contextLost = true;
    running = false;
    if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    onContextLost?.();
  };
  canvas.addEventListener("webglcontextlost", handleContextLost);

  const dispose = (): void => {
    motion.dispose();
    canvas.removeEventListener("webglcontextlost", handleContextLost);
    running = false;
    if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
    const disposedMaterials = new Set<THREE.Material>();
    const disposedTextures = new Set<THREE.Texture>();
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const material = object.material;
      if (disposedMaterials.has(material)) return;
      disposedMaterials.add(material);
      const map = material.map;
      if (map && !disposedTextures.has(map)) {
        disposedTextures.add(map);
        map.dispose();
      }
      material.dispose();
    });
    environmentTexture.dispose();
    renderer.dispose();
    pipeline.dispose();
  };

  return { resize, start, playIntro, scrollBy, scrollTo, dispose };
};
