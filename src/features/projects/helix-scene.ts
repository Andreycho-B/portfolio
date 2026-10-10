import * as THREE from "three";
import { createHelixWorld } from "./helix-cards";
import type { HelixCardDatum, HelixConfig, HelixSceneHandle } from "./helix-cards.types";
import { createPostPipeline } from "./helix-postfx";

// Cámara teleobjetivo: FOV estrecho (32°) que comprime la perspectiva
const CAMERA_FOV_DEG = 32;
const MAX_PIXEL_RATIO = 2;

// px de gesto que equivalen a una tarjeta de recorrido helicoidal
const PX_PER_SLOT = 140;
const FLOW_EASE = 0.075;

const CREME_BACKGROUND = new THREE.Color("#f5f1ea");

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
const frameHelix = (
  camera: THREE.PerspectiveCamera,
  world: Awaited<ReturnType<typeof createHelixWorld>>,
  aspect: number,
): void => {
  const shells = world.group.children;
  const bbox = new THREE.Box3();
  for (let i = 1; i <= 8 && i < shells.length; i++) {
    bbox.expandByObject(shells[i] ?? new THREE.Object3D());
  }
  const center = bbox.getCenter(new THREE.Vector3());
  const size = bbox.getSize(new THREE.Vector3());

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

const addLights = (scene: THREE.Scene): void => {
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(2, 4, 10);
  scene.add(keyLight);

  // Rim rasante superior-izquierda y contra desde la derecha, en blanco puro
  const rimUpper = new THREE.DirectionalLight(0xffffff, 4.5);
  rimUpper.position.set(-8, 12, 4);
  scene.add(rimUpper);

  const rimSide = new THREE.DirectionalLight(0xffffff, 3.0);
  rimSide.position.set(8, -6, -2);
  scene.add(rimSide);
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
  scene.background = CREME_BACKGROUND;
  addLights(scene);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 0.1, 100);
  camera.position.set(0, 2.4, 21);
  camera.lookAt(0, 0, 0);

  const world = await createHelixWorld(HELIX_CONFIG, cardData);
  scene.add(world.group);

  const pipeline = createPostPipeline(renderer, scene, camera, world.focusTarget);

  let animationFrameId: number | null = null;
  let running = false;
  let targetAdvance = 0;
  let currentAdvance = 0;
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scrollBy = (deltaPx: number): void => {
    targetAdvance += deltaPx / PX_PER_SLOT;
    if (reducedMotion) {
      currentAdvance = targetAdvance;
      world.setAdvance(currentAdvance);
    }
  };

  const resize = (width: number, height: number): void => {
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    frameHelix(camera, world, camera.aspect);
    pipeline.resize(width, height);
  };

  const frame = (): void => {
    if (!reducedMotion) {
      currentAdvance += (targetAdvance - currentAdvance) * FLOW_EASE;
      world.setAdvance(currentAdvance);
    }
    pipeline.composer.render();
    if (running) animationFrameId = requestAnimationFrame(frame);
  };

  const start = (): void => {
    if (running) return;
    running = true;
    animationFrameId = requestAnimationFrame(frame);
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
    renderer.dispose();
  };

  return { resize, start, scrollBy, dispose };
};
