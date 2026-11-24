import {
  type Camera,
  Group,
  MathUtils,
  Mesh,
  type Object3D,
  PlaneGeometry,
  type Scene,
  ShaderMaterial,
  Vector3,
} from "three";
import {
  HOTSPOT_FS,
  HOTSPOT_SPECS,
  HOTSPOT_VS,
  type HotspotSpec,
  type StudioHotspotId,
} from "./studio-hotspots-shader";
import type { StudioFocusTarget } from "./studio-prop-focus";

interface HotspotItem {
  readonly spec: HotspotSpec;
  readonly mesh: Mesh;
  readonly mat: ShaderMaterial;
  readonly worldPos: Vector3;
  hover: number;
}

export interface StudioHotspotsHandle {
  readonly meshes: readonly Mesh[];
  readonly resolveTarget: (object: Object3D) => StudioHotspotId | null;
  readonly setHoveredTarget: (target: StudioHotspotId | null) => void;
  readonly update: (
    dtSeconds: number,
    camera: Camera,
    zoomProgress: number,
    powerProgress: number,
    activeFocus: StudioFocusTarget | null,
    chairCueReady: boolean,
    isRetroChannel: boolean,
  ) => boolean;
  readonly isActive: () => boolean;
  readonly dispose: () => void;
}

export const createStudioHotspots = (targetScene: Scene): StudioHotspotsHandle => {
  const group = new Group();
  group.name = "studioInteractiveHotspots";
  const geometry = new PlaneGeometry(1, 1);
  const items: HotspotItem[] = [];
  const lookup = new Map<Object3D, StudioHotspotId>();

  const motionQuery =
    typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  let prefersReduced = motionQuery?.matches ?? false;
  let hoveredTarget: StudioHotspotId | null = null;
  let elapsed = 0;
  let seatedCue = 0;
  let propsReveal = 0;
  let chairLead = true;
  let powerCueUnlocked = false;
  let propsUnlocked = false;
  let anyVisible = true;

  for (const spec of HOTSPOT_SPECS) {
    const mat = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uHover: { value: 0 },
        uOpacity: { value: 1 },
        uPhase: { value: spec.phase },
        uReduced: { value: prefersReduced ? 1 : 0 },
        uWarm: { value: spec.warm ? 1 : 0 },
      },
      vertexShader: HOTSPOT_VS,
      fragmentShader: HOTSPOT_FS,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    });
    const mesh = new Mesh(geometry, mat);
    mesh.name = `hotspot_${spec.target}`;
    mesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    mesh.renderOrder = 10;
    group.add(mesh);
    lookup.set(mesh, spec.target);
    items.push({ spec, mesh, mat, worldPos: new Vector3(...spec.pos), hover: 0 });
  }
  targetScene.add(group);

  const onMotionChange = (): void => {
    prefersReduced = motionQuery?.matches ?? false;
    for (const item of items) {
      const u = item.mat.uniforms.uReduced;
      if (u) u.value = prefersReduced ? 1 : 0;
    }
  };
  motionQuery?.addEventListener("change", onMotionChange);

  const update = (
    dtSeconds: number,
    camera: Camera,
    zoomProgress: number,
    powerProgress: number,
    activeFocus: StudioFocusTarget | null,
    chairCueReady: boolean,
    isRetroChannel: boolean,
  ): boolean => {
    const dt = Math.min(Math.max(dtSeconds, 0), 0.05);
    if (!prefersReduced) elapsed += dt;
    if (chairLead && (activeFocus !== null || powerProgress > 0.15)) chairLead = false;
    if (!powerCueUnlocked && (chairCueReady || powerProgress > 0.15 || activeFocus === "tv")) {
      powerCueUnlocked = true;
    }
    if (!propsUnlocked && activeFocus === "tv") propsUnlocked = true;

    const zoomVis = 1 - MathUtils.smoothstep(zoomProgress, 0.02, 0.28);
    const cueTarget = activeFocus === "chair" && chairCueReady ? 1 : 0;
    const propsTarget = propsUnlocked ? 1 : 0;
    if (prefersReduced) {
      seatedCue = cueTarget;
      propsReveal = propsTarget;
    } else {
      const cueRate = cueTarget > seatedCue ? 3.2 : 10;
      seatedCue += (cueTarget - seatedCue) * (1 - Math.exp(-cueRate * dt));
      if (Math.abs(cueTarget - seatedCue) < 0.004) seatedCue = cueTarget;
      propsReveal += (propsTarget - propsReveal) * (1 - Math.exp(-4.5 * dt));
      if (Math.abs(propsTarget - propsReveal) < 0.004) propsReveal = propsTarget;
    }
    const cueAnimating =
      Math.abs(cueTarget - seatedCue) > 0.004 || Math.abs(propsTarget - propsReveal) > 0.004;
    const onFade = MathUtils.smoothstep(powerProgress, 0.35, 0.85);
    const offFade = 1 - MathUtils.smoothstep(powerProgress, 0.12, 0.55);
    const frontFade = MathUtils.smoothstep(camera.position.z, 0.35, 1.35);
    const hoverLerp = prefersReduced ? 1 : 1 - Math.exp(-12 * dt);

    let animatingHover = false;
    anyVisible = false;

    for (const item of items) {
      const { target, frontOnly } = item.spec;
      const targetHover = hoveredTarget === target ? 1 : 0;
      item.hover += (targetHover - item.hover) * hoverLerp;
      if (Math.abs(targetHover - item.hover) > 0.004) animatingHover = true;
      else item.hover = targetHover;

      let localVis = zoomVis;
      if (target === "tv") {
        const cleanScreen = isRetroChannel || (activeFocus === "chair" && propsUnlocked);
        localVis = cleanScreen ? 0 : Math.max(zoomVis, seatedCue) * onFade;
      } else if (target === "tv_power") {
        localVis = powerCueUnlocked ? Math.max(zoomVis, seatedCue) * offFade : 0;
      } else if (target !== "chair") localVis *= propsReveal;
      if (frontOnly) localVis *= frontFade;

      const isVisible = localVis > 0.004;
      item.mesh.visible = isVisible;
      if (!isVisible) continue;
      anyVisible = true;

      const dist = camera.position.distanceTo(item.worldPos);
      const baseScale =
        target === "tv_power"
          ? MathUtils.clamp(dist * 0.044, 0.2, 0.52)
          : MathUtils.clamp(dist * 0.048, 0.2, 0.72);
      const leadScale = chairLead && target === "chair" ? 1.18 : 1;
      item.mesh.scale.setScalar(baseScale * leadScale);
      item.mesh.quaternion.copy(camera.quaternion);
      const u = item.mat.uniforms;
      if (u.uTime) u.uTime.value = elapsed;
      if (u.uHover) u.uHover.value = item.hover;
      if (u.uOpacity) u.uOpacity.value = localVis;
    }

    const hiddenTab = typeof document !== "undefined" && document.visibilityState === "hidden";
    return animatingHover || cueAnimating || (anyVisible && !prefersReduced && !hiddenTab);
  };

  return {
    meshes: items.map((item) => item.mesh),
    resolveTarget: (object) => (object.visible ? (lookup.get(object) ?? null) : null),
    setHoveredTarget: (target) => {
      hoveredTarget = target;
    },
    update,
    isActive: () =>
      anyVisible &&
      !prefersReduced &&
      (typeof document === "undefined" || document.visibilityState !== "hidden"),
    dispose: () => {
      motionQuery?.removeEventListener("change", onMotionChange);
      targetScene.remove(group);
      geometry.dispose();
      for (const item of items) item.mat.dispose();
    },
  };
};
