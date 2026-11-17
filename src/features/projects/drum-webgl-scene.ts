import {
  Color,
  Group,
  HalfFloatType,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import type { DrumWebGLHandle, FrontCardBounds } from "./drum.types";
import { createDrumLensPostPass } from "./drum-glass-shader";
import { DRUM_SLOTS, PROJECTS } from "./project-data";

export type { DrumWebGLHandle, FrontCardBounds };

const BACKGROUND_HEX = 0xffffff;
const CARD_WIDTH = 2.8;
const CARD_GAP = 0.04;
const CARD_HEIGHT_PER_VIEW_HALF = 0.85;
const CAMERA_FOV_DEG = 36;
const TAN_HALF_FOV = Math.tan(MathUtils.degToRad(CAMERA_FOV_DEG / 2));
const CARD_WIDTH_RATIO_MAX = 0.84;
const CARD_WIDTH_RATIO_MIN = 0.34;
const SLOT_ANGLE = (2 * Math.PI) / DRUM_SLOTS;

const fitTextureCover = (tex: Texture, cardAspect: number): void => {
  const img = tex.image as { width: number; height: number } | undefined;
  if (!img?.width || !img.height) return;
  const isWider = img.width / img.height > cardAspect;
  const ratio = cardAspect / (img.width / img.height);
  tex.repeat.set(isWider ? ratio : 1, isWider ? 1 : 1 / ratio);
  tex.offset.set((1 - tex.repeat.x) / 2, (1 - tex.repeat.y) / 2);
};

export const createDrumWebGLScene = (
  canvas: HTMLCanvasElement,
  onTextureReady: () => void,
  onError?: (error: unknown) => void,
): DrumWebGLHandle | null => {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(dpr);
  } catch (err) {
    console.warn("[DrumWebGLScene] WebGL initialization failed:", err);
    onError?.(err);
    return null;
  }

  const handleContextLost = (event: Event) => {
    event.preventDefault();
    console.warn("[DrumWebGLScene] WebGL context lost");
    onError?.(new Error("WebGL context lost"));
  };
  canvas.addEventListener("webglcontextlost", handleContextLost);

  const scene = new Scene();
  scene.background = new Color(BACKGROUND_HEX);
  const camera = new PerspectiveCamera(CAMERA_FOV_DEG, 1, 0.1, 100);
  const drumGroup = new Group();
  scene.add(drumGroup);
  let cardAspect = 1;

  const texLoader = new TextureLoader();
  const projectTextures = PROJECTS.map((project) => {
    const tex = texLoader.load(
      project.imageSrc,
      (loaded) => {
        fitTextureCover(loaded, cardAspect);
        onTextureReady();
      },
      undefined,
      (err) => console.warn(`[DrumWebGLScene] Texture load failed: ${project.imageSrc}`, err),
    );
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  });

  const cardGeometry = new PlaneGeometry(CARD_WIDTH, 1);
  const cardMaterials = projectTextures.map(
    (tex) => new MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  const cardMeshes: Mesh[] = [];
  for (let i = 0; i < DRUM_SLOTS; i++) {
    const material = cardMaterials[i % cardMaterials.length];
    if (!material) continue;
    const mesh = new Mesh(cardGeometry, material);
    mesh.rotation.x = i * SLOT_ANGLE;
    drumGroup.add(mesh);
    cardMeshes.push(mesh);
  }

  const renderTarget = new WebGLRenderTarget(1, 1, { samples: 4, type: HalfFloatType });
  const postPass = createDrumLensPostPass(renderTarget);

  let frontBounds: FrontCardBounds = { widthRatio: 0, heightRatio: 0 };
  let scrollVelocity = 0;
  let baseCameraZ = 0;
  let introProgress = 1;

  const setIntroProgress = (progress: number): void => {
    introProgress = MathUtils.clamp(progress, 0, 1);
    if (baseCameraZ > 0) camera.position.z = baseCameraZ * (1 + (1 - introProgress) * 0.22);
  };

  const resize = (widthPx: number, heightPx: number): void => {
    const width = Math.max(1, widthPx);
    const height = Math.max(1, heightPx);
    const aspect = width / height;
    renderer.setSize(width, height, false);
    renderTarget.setSize(width * dpr, height * dpr);

    const widthRatio = MathUtils.clamp(
      CARD_WIDTH_RATIO_MAX - (aspect - 0.5) * 0.4,
      CARD_WIDTH_RATIO_MIN,
      CARD_WIDTH_RATIO_MAX,
    );
    const halfHeight = CARD_WIDTH / widthRatio / 2 / aspect;
    const cardHeight = CARD_HEIGHT_PER_VIEW_HALF * halfHeight;
    cardAspect = CARD_WIDTH / cardHeight;
    const radius = (cardHeight + CARD_GAP) / (2 * Math.sin(SLOT_ANGLE / 2));

    camera.aspect = aspect;
    baseCameraZ = halfHeight / TAN_HALF_FOV;
    camera.position.z = baseCameraZ * (1 + (1 - introProgress) * 0.22);
    camera.updateProjectionMatrix();

    drumGroup.position.z = -radius;
    cardMeshes.forEach((mesh, i) => {
      mesh.scale.set(1, cardHeight, 1);
      mesh.position.set(0, -radius * Math.sin(i * SLOT_ANGLE), radius * Math.cos(i * SLOT_ANGLE));
    });
    for (const tex of projectTextures) fitTextureCover(tex, cardAspect);
    frontBounds = {
      widthRatio: CARD_WIDTH / (2 * halfHeight * aspect),
      heightRatio: cardHeight / (2 * halfHeight),
    };
  };

  const render = (): void => {
    postPass.updateUniforms(scrollVelocity, introProgress);
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postPass.scene, postPass.camera);
  };

  const dispose = (): void => {
    canvas.removeEventListener("webglcontextlost", handleContextLost);
    for (const material of cardMaterials) material.dispose();
    for (const tex of projectTextures) tex.dispose();
    cardGeometry.dispose();
    postPass.dispose();
    renderTarget.dispose();
    renderer.dispose();
  };

  return {
    setRotation: (slotPosition: number) => {
      drumGroup.rotation.x = -slotPosition * SLOT_ANGLE;
    },
    setScrollVelocity: (vel: number) => {
      scrollVelocity = vel;
    },
    setIntroProgress,
    render,
    resize,
    getFrontCardBounds: () => frontBounds,
    dispose,
  };
};
