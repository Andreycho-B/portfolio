import * as THREE from "three";
import { DRUM_GLASS_FRAGMENT_SHADER, DRUM_GLASS_VERTEX_SHADER } from "./drum-glass-shader";
import { DRUM_SLOTS, PROJECTS } from "./project-data";

export interface FrontCardBounds {
  readonly widthRatio: number;
  readonly heightRatio: number;
}

export interface DrumWebGLHandle {
  setRotation: (slotPosition: number) => void;
  setScrollVelocity: (velocitySlotsPerSecond: number) => void;
  setIntroProgress: (progress: number) => void;
  render: () => void;
  resize: (widthPx: number, heightPx: number) => void;
  getFrontCardBounds: () => FrontCardBounds;
  dispose: () => void;
}

const BACKGROUND_HEX = 0xffffff;
const CARD_WIDTH = 2.8,
  CARD_HEIGHT = 1.33,
  CARD_GAP = 0.04;
const CAMERA_FOV_DEG = 36;
const TAN_HALF_FOV = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV_DEG / 2));
const CARD_WIDTH_RATIO_MAX = 0.84,
  CARD_WIDTH_RATIO_MIN = 0.34,
  CARD_HEIGHT_RATIO_MAX = 0.42;
const LENS_STRENGTH_BASE = 0.85,
  LENS_STRENGTH_GAIN = 0.045;
const CHROMATIC_BASE = 0.012,
  CHROMATIC_GAIN = 0.0035,
  LENS_VELOCITY_CAP = 8;

const SLOT_ANGLE = (2 * Math.PI) / DRUM_SLOTS;
const TANGENT_RADIUS = (CARD_HEIGHT + CARD_GAP) / (2 * Math.sin(SLOT_ANGLE / 2));

const fitTextureCover = (tex: THREE.Texture): void => {
  const img = tex.image as { width: number; height: number } | undefined;
  if (!img?.width || !img.height) return;
  const isWider = img.width / img.height > CARD_WIDTH / CARD_HEIGHT;
  const ratio = CARD_WIDTH / CARD_HEIGHT / (img.width / img.height);
  tex.repeat.set(isWider ? ratio : 1, isWider ? 1 : 1 / ratio);
  tex.offset.set((1 - tex.repeat.x) / 2, (1 - tex.repeat.y) / 2);
};

export const createDrumWebGLScene = (
  canvas: HTMLCanvasElement,
  onTextureReady: () => void,
): DrumWebGLHandle => {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND_HEX);
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 0.1, 100);
  const drumGroup = new THREE.Group();
  scene.add(drumGroup);

  const texLoader = new THREE.TextureLoader();
  const projectTextures = PROJECTS.map((project) => {
    const tex = texLoader.load(project.imageSrc, (loaded) => {
      fitTextureCover(loaded);
      onTextureReady();
    });
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  });

  const cardGeometry = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT);
  const cardMaterials = projectTextures.map(
    (tex) => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  const cardMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < DRUM_SLOTS; i++) {
    const material = cardMaterials[i % cardMaterials.length];
    if (!material) continue;
    const mesh = new THREE.Mesh(cardGeometry, material);
    mesh.rotation.x = i * SLOT_ANGLE;
    drumGroup.add(mesh);
    cardMeshes.push(mesh);
  }

  const layoutDrum = (radius: number): void => {
    drumGroup.position.z = -radius;
    cardMeshes.forEach((mesh, i) => {
      const angle = i * SLOT_ANGLE;
      mesh.position.set(0, -radius * Math.sin(angle), radius * Math.cos(angle));
    });
  };

  const renderTarget = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
  const postScene = new THREE.Scene();
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: renderTarget.texture },
      uBandTop: { value: 0.2 },
      uBandBot: { value: 0.2 },
      uStrength: { value: LENS_STRENGTH_BASE },
      uCurve: { value: 1.0 },
      uChromaticAberration: { value: CHROMATIC_BASE },
    },
    vertexShader: DRUM_GLASS_VERTEX_SHADER,
    fragmentShader: DRUM_GLASS_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
  });
  const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial);
  postScene.add(postQuad);

  let frontBounds: FrontCardBounds = { widthRatio: 0, heightRatio: 0 };
  let scrollVelocity = 0;
  let baseCameraZ = 0;
  let introProgress = 1;

  const setIntroProgress = (progress: number): void => {
    introProgress = THREE.MathUtils.clamp(progress, 0, 1);
    const cameraFactor = (1 - introProgress) * 0.22;
    if (baseCameraZ > 0) camera.position.z = baseCameraZ * (1 + cameraFactor);
  };

  const resize = (widthPx: number, heightPx: number): void => {
    const width = Math.max(1, widthPx);
    const height = Math.max(1, heightPx);
    const aspect = width / height;
    renderer.setSize(width, height, false);
    renderTarget.setSize(width * dpr, height * dpr);

    const widthRatio = THREE.MathUtils.clamp(
      CARD_WIDTH_RATIO_MAX - (aspect - 0.5) * 0.4,
      CARD_WIDTH_RATIO_MIN,
      CARD_WIDTH_RATIO_MAX,
    );
    let halfHeight = CARD_WIDTH / widthRatio / 2 / aspect;
    halfHeight = Math.max(halfHeight, CARD_HEIGHT / (2 * CARD_HEIGHT_RATIO_MAX));

    camera.aspect = aspect;
    baseCameraZ = halfHeight / TAN_HALF_FOV;
    const cameraFactor = (1 - introProgress) * 0.22;
    camera.position.z = baseCameraZ * (1 + cameraFactor);
    camera.updateProjectionMatrix();

    layoutDrum(TANGENT_RADIUS);
    frontBounds = {
      widthRatio: CARD_WIDTH / (2 * halfHeight * aspect),
      heightRatio: CARD_HEIGHT / (2 * halfHeight),
    };
  };

  const setRotation = (slotPosition: number): void => {
    drumGroup.rotation.x = -slotPosition * SLOT_ANGLE;
  };

  const setScrollVelocity = (velocitySlotsPerSecond: number): void => {
    scrollVelocity = velocitySlotsPerSecond;
  };

  const render = (): void => {
    const strengthUniform = postMaterial.uniforms.uStrength;
    const chromaticUniform = postMaterial.uniforms.uChromaticAberration;
    const bandTopUniform = postMaterial.uniforms.uBandTop;
    const bandBotUniform = postMaterial.uniforms.uBandBot;
    if (strengthUniform && chromaticUniform && bandTopUniform && bandBotUniform) {
      const spinSpeed = Math.min(Math.abs(scrollVelocity), LENS_VELOCITY_CAP);
      const opticalFactor = 1 - introProgress;
      const dynamicBand = 0.2 + spinSpeed * 0.008 + opticalFactor * 0.04;
      bandTopUniform.value = dynamicBand;
      bandBotUniform.value = dynamicBand;
      strengthUniform.value =
        LENS_STRENGTH_BASE + spinSpeed * LENS_STRENGTH_GAIN + opticalFactor * 0.22;
      chromaticUniform.value = CHROMATIC_BASE + spinSpeed * CHROMATIC_GAIN + opticalFactor * 0.024;
    }
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCamera);
  };

  const dispose = (): void => {
    for (const material of cardMaterials) material.dispose();
    for (const tex of projectTextures) tex.dispose();
    cardGeometry.dispose();
    postMaterial.dispose();
    postQuad.geometry.dispose();
    renderTarget.dispose();
    renderer.dispose();
  };

  const getFrontCardBounds = (): FrontCardBounds => frontBounds;

  return {
    setRotation,
    setScrollVelocity,
    setIntroProgress,
    render,
    resize,
    getFrontCardBounds,
    dispose,
  };
};
