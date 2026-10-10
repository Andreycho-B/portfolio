import {
  BloomEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
} from "postprocessing";
import * as THREE from "three";

// Sobre fondo crema (#f5f1ea ≈ luminancia 0.94) el umbral de bloom debe
// quedar por encima para que solo florezcan los destellos especulares
const BLOOM_LUMINANCE_THRESHOLD = 0.95;
const BLOOM_INTENSITY = 0.55;
const DOF_BOKEH_SCALE = 1.6;
const DOF_BOKEH_SCALE_DEGRADED = 0.8;
const DOF_RESOLUTION_Y = 480;
const COMPOSER_MULTISAMPLING = 4;

export type PostPipeline = {
  readonly composer: EffectComposer;
  readonly resize: (width: number, height: number) => void;
  readonly setDegraded: (degraded: boolean) => void;
  readonly dispose: () => void;
};

export const createPostPipeline = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  focusTarget: THREE.Vector3,
): PostPipeline => {
  const composer = new EffectComposer(renderer, {
    frameBufferType: THREE.HalfFloatType,
    multisampling: COMPOSER_MULTISAMPLING,
  });

  const depthOfField = new DepthOfFieldEffect(camera, {
    bokehScale: DOF_BOKEH_SCALE,
    resolutionY: DOF_RESOLUTION_Y,
  });
  depthOfField.target = focusTarget;

  const bloom = new BloomEffect({
    luminanceThreshold: BLOOM_LUMINANCE_THRESHOLD,
    luminanceSmoothing: 0.015,
    mipmapBlur: true,
    intensity: BLOOM_INTENSITY,
  });

  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new EffectPass(camera, depthOfField, bloom));

  return {
    composer,
    resize: (width, height) => {
      composer.setSize(width, height);
    },
    setDegraded: (degraded) => {
      depthOfField.bokehScale = degraded ? DOF_BOKEH_SCALE_DEGRADED : DOF_BOKEH_SCALE;
      bloom.intensity = degraded ? 0 : BLOOM_INTENSITY;
      composer.multisampling = degraded ? 0 : COMPOSER_MULTISAMPLING;
    },
    dispose: () => {
      composer.dispose();
    },
  };
};
