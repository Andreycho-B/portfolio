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
const DOF_HEIGHT = 480;

export type PostPipeline = {
  readonly composer: EffectComposer;
  readonly resize: (width: number, height: number) => void;
};

export const createPostPipeline = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  focusTarget: THREE.Vector3,
): PostPipeline => {
  const composer = new EffectComposer(renderer, {
    frameBufferType: THREE.HalfFloatType,
  });

  const depthOfField = new DepthOfFieldEffect(camera, {
    bokehScale: DOF_BOKEH_SCALE,
    height: DOF_HEIGHT,
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
  };
};
