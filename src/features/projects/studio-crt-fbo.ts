import {
  Color,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  UnsignedByteType,
  type WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { createDrumLensPostPass } from "./drum-glass-shader";
import { DRUM_SLOTS, PROJECTS } from "./project-data";
import type { StudioAssetTracker } from "./studio-loading-tracker";

export interface StudioCrtFboHandle {
  readonly texture: Texture;
  readonly markDirty: () => void;
  readonly updateState: (angleRad: number, scrollVelocity: number, introProgress: number) => void;
  readonly render: (minIntervalMs?: number, resolutionScale?: 0.5 | 1) => number;
  readonly dispose: () => void;
}

const FBO_WIDTH = 1024;
const FBO_HEIGHT = 716;
const FBO_ASPECT = FBO_WIDTH / FBO_HEIGHT;
const BACKGROUND_HEX = 0xffffff;
const CAMERA_FOV_DEG = 34;
const TAN_HALF_FOV = Math.tan(MathUtils.degToRad(CAMERA_FOV_DEG / 2));
const CAMERA_Z = 5.4;
const CARD_WIDTH_RATIO = 0.54;
const CARD_HEIGHT_RATIO = 0.84;
const CARD_GAP = 0.04;
const SLOT_ANGLE = (2 * Math.PI) / DRUM_SLOTS;

const fitTextureCover = (tex: Texture, cardAspect: number): void => {
  const img = tex.image as { width: number; height: number } | undefined;
  if (!img?.width || !img.height) return;
  const imgAspect = img.width / img.height;
  const isWider = imgAspect > cardAspect;
  const ratio = cardAspect / imgAspect;
  tex.repeat.set(isWider ? ratio : 1, isWider ? 1 : 1 / ratio);
  tex.offset.set(isWider ? (1 - tex.repeat.x) * 0.14 : 0, (1 - tex.repeat.y) / 2);
  tex.needsUpdate = true;
};

export const createStudioCrtFbo = (
  renderer: WebGLRenderer,
  onAssetLoaded: () => void,
  tracker?: StudioAssetTracker,
): StudioCrtFboHandle => {
  const drumScene = new Scene();
  drumScene.background = new Color(BACKGROUND_HEX);
  const drumCamera = new PerspectiveCamera(CAMERA_FOV_DEG, FBO_ASPECT, 0.1, 100);
  drumCamera.position.z = CAMERA_Z;

  const halfHeight = CAMERA_Z * TAN_HALF_FOV;
  const halfWidth = halfHeight * FBO_ASPECT;
  const cardWidth = halfWidth * 2 * CARD_WIDTH_RATIO;
  const cardHeight = CARD_HEIGHT_RATIO * halfHeight;
  const cardAspect = cardWidth / cardHeight;
  const drumRadius = (cardHeight + CARD_GAP) / (2 * Math.sin(SLOT_ANGLE / 2));

  const drumGroup = new Group();
  drumGroup.position.z = -drumRadius;
  drumScene.add(drumGroup);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const texLoader = new TextureLoader(tracker?.manager);
  let isDisposed = false;

  const projectTextures = PROJECTS.map((project) => {
    const done = tracker?.trackTask(2, "assets", "portadas de proyectos");
    const tex = texLoader.load(
      project.imageSrc,
      (loaded) => {
        if (!isDisposed) {
          fitTextureCover(loaded, cardAspect);
          onAssetLoaded();
        }
        done?.();
      },
      undefined,
      (err) => {
        console.warn(`[StudioCrtFbo] Texture load failed: ${project.imageSrc}`, err);
        done?.();
      },
    );
    tex.colorSpace = SRGBColorSpace;
    tex.minFilter = LinearMipmapLinearFilter;
    tex.magFilter = LinearFilter;
    tex.anisotropy = Math.min(4, maxAniso);
    return tex;
  });

  const cardGeometry = new PlaneGeometry(cardWidth, cardHeight);
  const cardMaterials = projectTextures.map(
    (tex) => new MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  const cardMeshes: Mesh[] = [];

  for (let i = 0; i < DRUM_SLOTS; i++) {
    const material = cardMaterials[i % cardMaterials.length];
    if (!material) continue;
    const mesh = new Mesh(cardGeometry, material);
    mesh.rotation.x = i * SLOT_ANGLE;
    mesh.position.set(
      0,
      -drumRadius * Math.sin(i * SLOT_ANGLE),
      drumRadius * Math.cos(i * SLOT_ANGLE),
    );
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    drumGroup.add(mesh);
    cardMeshes.push(mesh);
  }

  const rawTarget = new WebGLRenderTarget(FBO_WIDTH, FBO_HEIGHT, {
    samples: 0,
    stencilBuffer: false,
    type: UnsignedByteType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
  });
  const lensTarget = new WebGLRenderTarget(FBO_WIDTH, FBO_HEIGHT, {
    depthBuffer: false,
    stencilBuffer: false,
    type: UnsignedByteType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
  });
  lensTarget.texture.anisotropy = Math.min(4, maxAniso);
  const postPass = createDrumLensPostPass(rawTarget);
  let [isDirty, lastRenderMs, renderedScale] = [true, 0, 1 as 0.5 | 1];
  let [lastAngle, lastVel, lastIntro] = [Number.NaN, Number.NaN, Number.NaN];
  const markDirty = (): void => {
    isDirty = true;
  };
  const updateState = (angleRad: number, scrollVelocity: number, introProgress: number): void => {
    const clampedIntro = MathUtils.clamp(introProgress, 0, 1);
    if (
      Math.abs(angleRad - lastAngle) < 0.0001 &&
      Math.abs(scrollVelocity - lastVel) < 0.001 &&
      Math.abs(clampedIntro - lastIntro) < 0.0005
    ) {
      return;
    }
    lastAngle = angleRad;
    lastVel = scrollVelocity;
    lastIntro = clampedIntro;
    drumGroup.rotation.x = -angleRad;
    drumCamera.position.z = CAMERA_Z * (1 + (1 - clampedIntro) * 0.22);
    postPass.updateUniforms(scrollVelocity, clampedIntro);
    isDirty = true;
  };
  const render = (minIntervalMs = 0, resolutionScale: 0.5 | 1 = 1): number => {
    const scaleChanged = resolutionScale !== renderedScale;
    if (!isDirty && !scaleChanged) return renderedScale;
    const now = performance.now();
    if (!scaleChanged && minIntervalMs > 0 && now - lastRenderMs < minIntervalMs) {
      return renderedScale;
    }
    lastRenderMs = now;
    isDirty = false;
    renderedScale = resolutionScale;
    const vw = Math.round(FBO_WIDTH * resolutionScale);
    const vh = Math.round(FBO_HEIGHT * resolutionScale);
    rawTarget.viewport.set(0, 0, vw, vh);
    lensTarget.viewport.set(0, 0, vw, vh);
    postPass.setUvScale(resolutionScale);
    const prevTarget = renderer.getRenderTarget();
    const prevToneMapping = renderer.toneMapping;
    renderer.toneMapping = NoToneMapping;
    renderer.setRenderTarget(rawTarget);
    renderer.render(drumScene, drumCamera);
    renderer.setRenderTarget(lensTarget);
    renderer.render(postPass.scene, postPass.camera);
    renderer.toneMapping = prevToneMapping;
    renderer.setRenderTarget(prevTarget);
    return renderedScale;
  };
  const dispose = (): void => {
    isDisposed = true;
    for (const mesh of cardMeshes) drumGroup.remove(mesh);
    for (const r of [...cardMaterials, ...projectTextures]) r.dispose();
    for (const r of [cardGeometry, postPass, rawTarget, lensTarget]) r.dispose();
  };
  return { texture: lensTarget.texture, markDirty, updateState, render, dispose };
};
