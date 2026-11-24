import { Mesh, ShaderMaterial, type Texture, Vector2, Vector4 } from "three";
import { createCrtGlassDomeGeometry } from "./macintosh-crt-geometry";
import { CRT_GLASS_FRAGMENT_SHADER, CRT_GLASS_VERTEX_SHADER } from "./macintosh-crt-shaders";
import type { StudioFluidWaveVec } from "./studio-crt-fluid-wipe";

export interface MacintoshCrtGlassHandle {
  readonly mesh: Mesh;
  readonly setRoughnessMap: (tex: Texture) => void;
  readonly setChannelTexture: (tex: Texture | null) => void;
  readonly setPortalState: (mode: number, cutout: number, wave: StudioFluidWaveVec) => void;
  readonly setTitleFade: (fade: number) => void;
  readonly setDrumUvScale: (scale: number) => void;
  readonly updatePointer: (nx: number, ny: number) => void;
  readonly updatePower: (power: number) => void;
  readonly dispose: () => void;
}

export const createMacintoshCrtGlass = (
  tDrum: Texture,
  tEditorial: Texture,
  tPortal: Texture,
): MacintoshCrtGlassHandle => {
  const pointer = new Vector2(0, 0);
  const fluidWave = new Vector4(0, 0, 0, 0);
  const geometry = createCrtGlassDomeGeometry();
  const material = new ShaderMaterial({
    uniforms: {
      uPointer: { value: pointer },
      uPower: { value: 0 },
      uHasRoughness: { value: 0 },
      uPortalMode: { value: 0 },
      uPortalCutout: { value: 0 },
      uTitleFade: { value: 1 },
      uDrumUvScale: { value: 1 },
      uFluidWave: { value: fluidWave },
      tDrum: { value: tDrum },
      tEditorial: { value: tEditorial },
      tPortal: { value: tPortal },
      tRoughness: { value: tDrum },
    },
    vertexShader: CRT_GLASS_VERTEX_SHADER,
    fragmentShader: CRT_GLASS_FRAGMENT_SHADER,
  });

  const mesh = new Mesh(geometry, material);
  mesh.name = "crtGlassDome";
  mesh.renderOrder = -1;
  mesh.updateMatrix();
  mesh.matrixAutoUpdate = false;

  const setRoughnessMap = (tex: Texture): void => {
    const roughUniform = material.uniforms.tRoughness;
    const flagUniform = material.uniforms.uHasRoughness;
    if (roughUniform) roughUniform.value = tex;
    if (flagUniform) flagUniform.value = 1;
  };

  const setChannelTexture = (tex: Texture | null): void => {
    const portalUniform = material.uniforms.tPortal;
    if (portalUniform) portalUniform.value = tex ?? tPortal;
  };

  const setPortalState = (mode: number, cutout: number, wave: StudioFluidWaveVec): void => {
    if (material.uniforms.uPortalMode) material.uniforms.uPortalMode.value = mode;
    if (material.uniforms.uPortalCutout) material.uniforms.uPortalCutout.value = cutout;
    fluidWave.set(wave[0], wave[1], wave[2], wave[3]);
  };

  const setTitleFade = (fade: number): void => {
    if (material.uniforms.uTitleFade) material.uniforms.uTitleFade.value = fade;
  };

  const setDrumUvScale = (scale: number): void => {
    if (material.uniforms.uDrumUvScale) material.uniforms.uDrumUvScale.value = scale;
  };

  const updatePointer = (nx: number, ny: number): void => {
    pointer.set(nx, ny);
  };

  const updatePower = (power: number): void => {
    const uniform = material.uniforms.uPower;
    if (uniform) uniform.value = power;
  };

  const dispose = (): void => {
    geometry.dispose();
    material.dispose();
  };

  return {
    mesh,
    setRoughnessMap,
    setChannelTexture,
    setPortalState,
    setTitleFade,
    setDrumUvScale,
    updatePointer,
    updatePower,
    dispose,
  };
};
