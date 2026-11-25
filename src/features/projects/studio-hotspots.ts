import {
  type Camera,
  InstancedBufferAttribute,
  InstancedMesh,
  type Intersection,
  MathUtils,
  Matrix4,
  PlaneGeometry,
  type Scene,
  ShaderMaterial,
  Vector3,
} from "three";
import {
  HOTSPOT_INSTANCED_FS,
  HOTSPOT_INSTANCED_VS,
  HOTSPOT_SPECS,
  type StudioHotspotId,
} from "./studio-hotspots-shader";
import type { StudioFocusTarget } from "./studio-prop-focus";

export interface StudioHotspotsHandle {
  readonly mesh: InstancedMesh;
  readonly resolveHit: (hit: Intersection) => StudioHotspotId | null;
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
  readonly dispose: () => void;
}

const ZERO_MAT = new Matrix4().makeScale(0, 0, 0);
const dampTo = (cur: number, target: number, rate: number, dt: number): number => {
  const next = cur + (target - cur) * (1 - Math.exp(-rate * dt));
  return Math.abs(target - next) < 0.004 ? target : next;
};

export const createStudioHotspots = (targetScene: Scene): StudioHotspotsHandle => {
  const count = HOTSPOT_SPECS.length;
  const geometry = new PlaneGeometry(1, 1);
  const stateData = new Float32Array(count * 4);
  const worldPositions = HOTSPOT_SPECS.map((s) => new Vector3(s.pos[0], s.pos[1], s.pos[2]));
  const [hovers, visibleFlags] = [new Float32Array(count), new Uint8Array(count)];
  for (let i = 0; i < count; i += 1) {
    const spec = HOTSPOT_SPECS[i];
    if (!spec) continue;
    [stateData[i * 4 + 2], stateData[i * 4 + 3]] = [spec.phase, spec.highlight ? 1 : 0];
  }
  const stateAttr = new InstancedBufferAttribute(stateData, 4);
  geometry.setAttribute("aHotspotState", stateAttr);

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
  const material = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uReduced: { value: prefersReduced ? 1 : 0 } },
    vertexShader: HOTSPOT_INSTANCED_VS,
    fragmentShader: HOTSPOT_INSTANCED_FS,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });
  const mesh = new InstancedMesh(geometry, material, count);
  [mesh.name, mesh.renderOrder, mesh.frustumCulled] = ["studioInteractiveHotspots", 10, false];
  for (let i = 0; i < count; i += 1) mesh.setMatrixAt(i, ZERO_MAT);
  mesh.instanceMatrix.needsUpdate = true;
  targetScene.add(mesh);

  const onMotionChange = (): void => {
    prefersReduced = motionQuery?.matches ?? false;
    if (material.uniforms.uReduced) material.uniforms.uReduced.value = prefersReduced ? 1 : 0;
  };
  motionQuery?.addEventListener("change", onMotionChange);
  const [camDir, pos, scaleVec] = [new Vector3(), new Vector3(), new Vector3()];
  const mat4 = new Matrix4();

  const update = (
    dtRaw: number,
    camera: Camera,
    zoomProgress: number,
    powerProgress: number,
    activeFocus: StudioFocusTarget | null,
    chairCueReady: boolean,
    isRetroChannel: boolean,
  ): boolean => {
    const dt = Math.min(Math.max(dtRaw, 0), 0.05);
    if (!prefersReduced) st.elapsed += dt;
    if (st.chairLead && (activeFocus !== null || powerProgress > 0.15)) st.chairLead = false;
    if (activeFocus === "chair") st.wasSeated = true;
    if (activeFocus === "tv") st.tvExplored = true;
    const stoodUp = st.wasSeated && activeFocus === null;
    st.powerCueUnlocked ||=
      chairCueReady || powerProgress > 0.15 || activeFocus === "tv" || stoodUp;
    st.propsUnlocked ||= activeFocus === "tv" || powerProgress > 0.5 || stoodUp;

    const zoomVis = 1 - MathUtils.smoothstep(zoomProgress, 0.02, 0.28);
    const cueTarget = activeFocus === "chair" && (chairCueReady || powerProgress > 0.15) ? 1 : 0;
    const propsTarget = st.propsUnlocked ? 1 : 0;
    const cueRate = cueTarget > st.seatedCue ? 3.2 : 10;
    st.seatedCue = prefersReduced ? cueTarget : dampTo(st.seatedCue, cueTarget, cueRate, dt);
    st.propsReveal = prefersReduced ? propsTarget : dampTo(st.propsReveal, propsTarget, 4.5, dt);
    const cueAnim = st.seatedCue !== cueTarget || st.propsReveal !== propsTarget;

    const onFade = MathUtils.smoothstep(powerProgress, 0.35, 0.85);
    const offFade = 1 - MathUtils.smoothstep(powerProgress, 0.12, 0.55);
    const frontFade = MathUtils.smoothstep(camera.position.z, 0.35, 1.35);
    let [animHover, stateDirty, matrixDirty] = [false, false, false];
    st.anyVisible = false;

    for (let i = 0; i < count; i += 1) {
      const [spec, worldPos] = [HOTSPOT_SPECS[i], worldPositions[i]];
      if (!spec || !worldPos) continue;
      const targetHover = hoveredTarget === spec.target ? 1 : 0;
      hovers[i] = prefersReduced ? targetHover : dampTo(hovers[i] ?? 0, targetHover, 12, dt);
      if (hovers[i] !== targetHover) animHover = true;

      let localVis = zoomVis;
      if (spec.target === "tv") {
        const hide = isRetroChannel || (activeFocus === "chair" && st.tvExplored);
        localVis = hide ? 0 : Math.max(zoomVis, st.seatedCue) * onFade;
      } else if (spec.target === "tv_power") {
        localVis = st.powerCueUnlocked ? Math.max(zoomVis, st.seatedCue) * offFade : 0;
      } else if (spec.target !== "chair") localVis *= st.propsReveal;
      if (spec.frontOnly) localVis *= frontFade;

      const isVisible = localVis > 0.004;
      const idx = i * 4;
      const nextOp = isVisible ? localVis : 0;
      if (stateData[idx] !== hovers[i] || stateData[idx + 1] !== nextOp) {
        [stateData[idx], stateData[idx + 1]] = [hovers[i] ?? 0, nextOp];
        stateDirty = true;
      }
      if (!isVisible) {
        if (visibleFlags[i] !== 0) {
          visibleFlags[i] = 0;
          mesh.setMatrixAt(i, ZERO_MAT);
          matrixDirty = true;
        }
        continue;
      }
      visibleFlags[i] = 1;
      st.anyVisible = true;
      pos.copy(worldPos);
      if (spec.rayPull) {
        camDir.subVectors(camera.position, worldPos).normalize();
        pos.addScaledVector(camDir, spec.rayPull);
      }
      const [k, lo, hi] = spec.scale ?? [0.048, 0.2, 0.72];
      const base = MathUtils.clamp(camera.position.distanceTo(pos) * k, lo, hi);
      const s = base * (st.chairLead && spec.target === "chair" ? 1.18 : 1);
      mat4.compose(pos, camera.quaternion, scaleVec.set(s, s, 1));
      mesh.setMatrixAt(i, mat4);
      matrixDirty = true;
    }
    mesh.visible = st.anyVisible;
    if (matrixDirty) mesh.instanceMatrix.needsUpdate = true;
    if (stateDirty) stateAttr.needsUpdate = true;
    if (st.anyVisible && material.uniforms.uTime) material.uniforms.uTime.value = st.elapsed;
    const docVis = typeof document === "undefined" || document.visibilityState !== "hidden";
    return animHover || cueAnim || (st.anyVisible && !prefersReduced && docVis);
  };

  return {
    mesh,
    resolveHit: (hit) =>
      hit.object === mesh && hit.instanceId !== undefined && visibleFlags[hit.instanceId] === 1
        ? (HOTSPOT_SPECS[hit.instanceId]?.target ?? null)
        : null,
    setHoveredTarget: (target) => {
      hoveredTarget = target;
    },
    update,
    dispose: () => {
      motionQuery?.removeEventListener("change", onMotionChange);
      targetScene.remove(mesh);
      geometry.dispose();
      material.dispose();
    },
  };
};
