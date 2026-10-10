import * as THREE from "three";
import { createHelixWorld } from "./helix-cards";
import type { HelixCardDatum, HelixConfig, HelixSceneHandle } from "./helix-cards.types";
import { setupHelixEnvironment } from "./helix-environment";
import { CREME_BACKGROUND } from "./helix-materials";
import { createPostPipeline } from "./helix-postfx";

// Cámara teleobjetivo: FOV estrecho (32°) que comprime la perspectiva
const CAMERA_FOV_DEG = 32;
const MAX_PIXEL_RATIO = 2;

// px de gesto que equivalen a una tarjeta de recorrido helicoidal
const PX_PER_SLOT = 140;
const FLOW_EASE = 0.075;
const FLOW_EPSILON = 1e-4;
const IDLE_FRAME_LIMIT = 2;

const CREME_BACKGROUND_COLOR = new THREE.Color(CREME_BACKGROUND);

const HELIX_CONFIG: HelixConfig = {
  cardCount: 12,
  radius: 5.5,
  angleStep: THREE.MathUtils.degToRad(16),
  axialStep: 0.85,
  cardWidth: 3.0,
  cardHeight: 4.25,
  cardThickness: 0.08,
  pitch: THREE.MathUtils.degToRad(-32),
  yaw: THREE.MathUtils.degToRad(22),
  groupRoll: THREE.MathUtils.degToRad(-135),
  groupElevation: THREE.MathUtils.degToRad(15),
};

// Encuadre automático sobre el arco visible (tarjetas 1..8): la tarjeta
// frontal queda deliberadamente recortada por el borde inferior-izquierdo
// del encuadre, como en la referencia. FOV teleobjetivo conservado.
// El bbox es canónico (slots 1..8): el encuadre no depende del avance.
const frameHelix = (
  camera: THREE.PerspectiveCamera,
  framingBox: THREE.Box3,
  aspect: number,
): void => {
  const center = framingBox.getCenter(new THREE.Vector3());
  const size = framingBox.getSize(new THREE.Vector3());

  const margin = 1.06;
  const halfHeight = (size.y * margin) / 2;
  const halfWidth = (size.x * margin) / 2;
  const halfFovRad = THREE.MathUtils.degToRad(CAMERA_FOV_DEG) / 2;
  const distanceByHeight = halfHeight / Math.tan(halfFovRad);
  const distanceByWidth = halfWidth / (Math.tan(halfFovRad) * aspect);
  const distance = Math.max(distanceByHeight, distanceByWidth);

  camera.position.set(center.x, center.y + distance * 0.1, center.z + distance);
  camera.lookAt(center);
};

export const createHelixScene = async (
  canvas: HTMLCanvasElement,
  cardData: readonly HelixCardDatum[],
): Promise<HelixSceneHandle | null> => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
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
  let targetAdvance = 0;
  let currentAdvance = 0;
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const schedule = (): void => {
    needsRender = true;
    if (!running) {
      running = true;
      idleFrames = 0;
      animationFrameId = requestAnimationFrame(frame);
    }
  };

  const scrollBy = (deltaPx: number): void => {
    targetAdvance += deltaPx / PX_PER_SLOT;
    if (reducedMotion) {
      currentAdvance = targetAdvance;
      world.setAdvance(currentAdvance);
    }
    schedule();
  };

  const scrollTo = (slots: number): void => {
    targetAdvance = slots;
    if (reducedMotion) {
      currentAdvance = targetAdvance;
      world.setAdvance(currentAdvance);
    }
    schedule();
  };

  const resize = (width: number, height: number): void => {
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    frameHelix(camera, world.framingBox, camera.aspect);
    pipeline.resize(width, height);
    schedule();
  };

  const frame = (): void => {
    animationFrameId = null;
    if (!reducedMotion && Math.abs(targetAdvance - currentAdvance) > FLOW_EPSILON) {
      currentAdvance += (targetAdvance - currentAdvance) * FLOW_EASE;
      world.setAdvance(currentAdvance);
      needsRender = true;
    }
    if (needsRender) {
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

  const dispose = (): void => {
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

  return { resize, start, scrollBy, scrollTo, dispose };
};
