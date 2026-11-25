import {
  type Camera,
  DirectionalLight,
  EquirectangularReflectionMapping,
  HalfFloatType,
  HemisphereLight,
  NeutralToneMapping,
  PCFShadowMap,
  PMREMGenerator,
  type Scene,
  SRGBColorSpace,
  type Texture,
  WebGLRenderer,
  type WebGLRenderTarget,
} from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { STUDIO_WORLD, type StudioEnvironmentHandle } from "./studio.types";
import { createStudioDustMotes } from "./studio-dust-motes";
import type { StudioAssetTracker } from "./studio-loading-tracker";

export const resolveStudioPixelRatio = (widthPx: number, heightPx: number): number => {
  const nativeDpr = window.devicePixelRatio || 1;
  const isWideDesktop = widthPx >= 1280 || widthPx * heightPx >= 1_200_000;
  return Math.min(nativeDpr, isWideDesktop ? 1.25 : 1.5);
};

const createStudioRenderer = (canvas: HTMLCanvasElement): WebGLRenderer => {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    premultipliedAlpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(
    resolveStudioPixelRatio(
      canvas.clientWidth || window.innerWidth,
      canvas.clientHeight || window.innerHeight,
    ),
  );
  renderer.setClearColor(STUDIO_WORLD.backgroundHex, 1);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  return renderer;
};

interface StudioGpuInit {
  readonly renderer: WebGLRenderer;
  readonly unbindContextLost: () => void;
}

export const initStudioRenderer = (
  canvas: HTMLCanvasElement,
  onError?: (error: unknown) => void,
): StudioGpuInit | null => {
  let renderer: WebGLRenderer;
  try {
    renderer = createStudioRenderer(canvas);
  } catch (err) {
    console.warn("[StudioWebGLScene] WebGL initialization failed:", err);
    onError?.(err);
    return null;
  }
  const onContextLost = (event: Event): void => {
    event.preventDefault();
    console.warn("[StudioWebGLScene] WebGL context lost");
    onError?.(new Error("WebGL context lost"));
  };
  canvas.addEventListener("webglcontextlost", onContextLost);
  return {
    renderer,
    unbindContextLost: () => canvas.removeEventListener("webglcontextlost", onContextLost),
  };
};

const GOLDEN_HOUR_HDR_URL = "/models3D/syferfontein_1d_clear_puresky_2k.hdr";
const HDR_YAW_ROTATION = -1.4565;

export const createStudioEnvironment = (
  renderer: WebGLRenderer,
  targetScene: Scene,
  camera: Camera,
  onAssetLoaded?: () => void,
  tracker?: StudioAssetTracker,
): StudioEnvironmentHandle => {
  let isDisposed = false;
  let hdrTexture: Texture | null = null;
  let envTarget: WebGLRenderTarget | null = null;
  const dustMotes = createStudioDustMotes(targetScene);

  const sunLight = new DirectionalLight(0xffa448, 5.2);
  sunLight.position.set(-11.1, 6.0, 19.9);
  sunLight.target.position.set(0.4, -2.5, -0.6);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 6.0;
  sunLight.shadow.camera.far = 48.0;
  sunLight.shadow.camera.left = -8.6;
  sunLight.shadow.camera.right = 8.6;
  sunLight.shadow.camera.top = 7.8;
  sunLight.shadow.camera.bottom = -7.8;
  sunLight.shadow.bias = -0.00022;
  sunLight.shadow.normalBias = 0.015;
  sunLight.shadow.radius = 2.4;
  sunLight.updateMatrixWorld(true);
  sunLight.target.updateMatrixWorld(true);

  const skyBounce = new HemisphereLight(0x88a8dc, 0xb8aa9c, 0.36);
  targetScene.add(sunLight, sunLight.target, skyBounce);

  const done = tracker?.trackTask(12, "environment", "cielo golden hour");
  const loader = new HDRLoader(tracker?.manager);
  loader.setDataType(HalfFloatType);
  loader.load(
    GOLDEN_HOUR_HDR_URL,
    (loadedHdr) => {
      const finalize = (): void => {
        if (isDisposed) {
          loadedHdr.dispose();
          done?.();
          return;
        }
        loadedHdr.mapping = EquirectangularReflectionMapping;
        loadedHdr.generateMipmaps = false;
        hdrTexture = loadedHdr;

        const pmrem = new PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        envTarget = pmrem.fromEquirectangular(loadedHdr);
        pmrem.dispose();

        targetScene.background = loadedHdr;
        targetScene.backgroundIntensity = 0.94;
        targetScene.backgroundRotation.set(0, HDR_YAW_ROTATION, 0);
        targetScene.environment = envTarget.texture;
        targetScene.environmentIntensity = 0.28;
        targetScene.environmentRotation.set(0, HDR_YAW_ROTATION, 0);

        onAssetLoaded?.();
        done?.();
      };
      if (tracker) tracker.enqueuePostLoad(finalize);
      else finalize();
    },
    undefined,
    (err) => {
      console.warn("[StudioEnvironment] Failed to load golden-hour HDRI:", err);
      done?.();
    },
  );

  const dispose = (): void => {
    isDisposed = true;
    dustMotes.dispose();
    targetScene.background = null;
    targetScene.environment = null;
    targetScene.remove(sunLight, sunLight.target, skyBounce);
    sunLight.shadow.map?.dispose();
    envTarget?.dispose();
    hdrTexture?.dispose();
  };

  return {
    updatePointerLight: dustMotes.setPointer,
    updateSkyTime: (dt, zoom = 0, focus = null) => dustMotes.update(dt, camera, zoom, focus),
    dispose,
  };
};
