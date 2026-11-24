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
  const camDir = new Vector3();

  const motionQuery =
    typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  let prefersReduced = motionQuery?.matches ?? false;
  let hoveredTarget: StudioHotspotId | null = null;
  const st = {
    elapsed: 0,
    seatedCue: 0,
    propsReveal: 0,
    chairLead: true,
    wasSeated: false,
    tvExplored: false,
    powerCueUnlocked: false,
    propsUnlocked: false,
    anyVisible: true,
  };
  for (const spec of HOTSPOT_SPECS) {
    const uniforms = {
      uTime: { value: 0 },
      uHover: { value: 0 },
      uOpacity: { value: 1 },
      uPhase: { value: spec.phase },
      uReduced: { value: prefersReduced ? 1 : 0 },
      uHighlight: { value: spec.highlight ? 1 : 0 },
    };
    const mat = new ShaderMaterial({
      uniforms,
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
      if (item.mat.uniforms.uReduced) item.mat.uniforms.uReduced.value = prefersReduced ? 1 : 0;
    }
  };
  motionQuery?.addEventListener("change", onMotionChange);
  const isDocVisible = (): boolean =>
    typeof document === "undefined" || document.visibilityState !== "hidden";

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
    if (!prefersReduced) st.elapsed += dt;
    if (st.chairLead && (activeFocus !== null || powerProgress > 0.15)) st.chairLead = false;
    if (activeFocus === "chair") st.wasSeated = true;
    if (activeFocus === "tv") st.tvExplored = true;
    const stoodUp = st.wasSeated && activeFocus === null;
    if (chairCueReady || powerProgress > 0.15 || activeFocus === "tv" || stoodUp)
      st.powerCueUnlocked = true;
    if (activeFocus === "tv" || powerProgress > 0.5 || stoodUp) st.propsUnlocked = true;
    const zoomVis = 1 - MathUtils.smoothstep(zoomProgress, 0.02, 0.28);
    const [cueTarget, propsTarget] = [
      activeFocus === "chair" && (chairCueReady || powerProgress > 0.15) ? 1 : 0,
      st.propsUnlocked ? 1 : 0,
    ];
    if (prefersReduced) [st.seatedCue, st.propsReveal] = [cueTarget, propsTarget];
    else {
      const cueRate = cueTarget > st.seatedCue ? 3.2 : 10;
      st.seatedCue += (cueTarget - st.seatedCue) * (1 - Math.exp(-cueRate * dt));
      if (Math.abs(cueTarget - st.seatedCue) < 0.004) st.seatedCue = cueTarget;
      st.propsReveal += (propsTarget - st.propsReveal) * (1 - Math.exp(-4.5 * dt));
      if (Math.abs(propsTarget - st.propsReveal) < 0.004) st.propsReveal = propsTarget;
    }
    const cueAnimating =
      Math.abs(cueTarget - st.seatedCue) > 0.004 || Math.abs(propsTarget - st.propsReveal) > 0.004;
    const onFade = MathUtils.smoothstep(powerProgress, 0.35, 0.85);
    const offFade = 1 - MathUtils.smoothstep(powerProgress, 0.12, 0.55);
    const frontFade = MathUtils.smoothstep(camera.position.z, 0.35, 1.35);
    const hoverLerp = prefersReduced ? 1 : 1 - Math.exp(-12 * dt);
    let animatingHover = false;
    st.anyVisible = false;

    for (const item of items) {
      const { target, frontOnly } = item.spec;
      const targetHover = hoveredTarget === target ? 1 : 0;
      item.hover += (targetHover - item.hover) * hoverLerp;
      if (Math.abs(targetHover - item.hover) > 0.004) animatingHover = true;
      else item.hover = targetHover;

      let localVis = zoomVis;
      if (target === "tv") {
        const cleanScreen = isRetroChannel || (activeFocus === "chair" && st.tvExplored);
        localVis = cleanScreen ? 0 : Math.max(zoomVis, st.seatedCue) * onFade;
      } else if (target === "tv_power") {
        localVis = st.powerCueUnlocked ? Math.max(zoomVis, st.seatedCue) * offFade : 0;
      } else if (target !== "chair") localVis *= st.propsReveal;
      if (frontOnly) localVis *= frontFade;

      const isVisible = localVis > 0.004;
      item.mesh.visible = isVisible;
      if (!isVisible) continue;
      st.anyVisible = true;

      if (item.spec.rayPull) {
        camDir.subVectors(camera.position, item.worldPos).normalize();
        item.mesh.position.copy(item.worldPos).addScaledVector(camDir, item.spec.rayPull);
      }
      const dist = camera.position.distanceTo(item.mesh.position);
      const [k, lo, hi] = item.spec.scale ?? [0.048, 0.2, 0.72];
      const baseScale = MathUtils.clamp(dist * k, lo, hi);
      item.mesh.scale.setScalar(baseScale * (st.chairLead && target === "chair" ? 1.18 : 1));
      item.mesh.quaternion.copy(camera.quaternion);
      const u = item.mat.uniforms;
      if (u.uTime) u.uTime.value = st.elapsed;
      if (u.uHover) u.uHover.value = item.hover;
      if (u.uOpacity) u.uOpacity.value = localVis;
    }
    return animatingHover || cueAnimating || (st.anyVisible && !prefersReduced && isDocVisible());
  };

  return {
    meshes: items.map((item) => item.mesh),
    resolveTarget: (object) => (object.visible ? (lookup.get(object) ?? null) : null),
    setHoveredTarget: (target) => {
      hoveredTarget = target;
    },
    update,
    isActive: () => st.anyVisible && !prefersReduced && isDocVisible(),
    dispose: () => {
      motionQuery?.removeEventListener("change", onMotionChange);
      targetScene.remove(group);
      geometry.dispose();
      for (const item of items) item.mat.dispose();
    },
  };
};
