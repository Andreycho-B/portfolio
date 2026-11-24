import { MathUtils, PerspectiveCamera, Vector3 } from "three";
import { STUDIO_CAM, STUDIO_WORLD, type StudioCameraState } from "./studio.types";
import {
  applyIntroOrbitStep,
  applyStudioCameraPose,
  makeSpring,
  resetSpringAxis,
  SHOWCASE_ANGLES,
  snapSpringAxes,
  stepSpringGroup,
  wrapAngle,
} from "./studio-camera-pose";
import {
  applySeatedLookDelta,
  createChairBreathMotion,
  type StudioCameraView,
} from "./studio-chair-view";
import {
  resolveStudioFocusPose,
  type StudioFocusCameraPose,
  type StudioFocusTarget,
} from "./studio-prop-focus";

export const createStudioCameraRig = (): StudioCameraState => {
  const { clamp } = MathUtils;
  const w = STUDIO_WORLD;
  const camera = new PerspectiveCamera(w.cameraFovDeg, 1, w.cameraNear, w.cameraFar);
  const halfFovFactor = 0.5 / Math.tan(MathUtils.degToRad(w.cameraFovDeg * 0.5));
  const lookTarget = new Vector3(0, w.targetY, 0);
  const [yaw0, elev0] = [w.initialOrbitYawRad, w.baseElevationRad];
  const [sx, sy, sZoom, sSwap] = [makeSpring(), makeSpring(), makeSpring(), makeSpring(1)];
  const [sYaw, sPitch, sDist] = [makeSpring(yaw0), makeSpring(elev0), makeSpring(1)];
  const [fYaw, fPitch, fDist] = [makeSpring(), makeSpring(), makeSpring(1)];
  const allMotionAxes = [sYaw, sPitch, sDist, sZoom, sSwap, fYaw, fPitch, fDist];
  const st = { idx: 0, aspect: 1, radius: 10.6, intro: false, elapsed: 0 };
  const breath = createChairBreathMotion();
  let activeFocus: StudioFocusTarget | null = null;
  let prevPose: StudioFocusCameraPose = resolveStudioFocusPose("tv");
  let nextPose: StudioFocusCameraPose = prevPose;
  let lastView: StudioCameraView | null = null;
  let prevView: StudioCameraView | null = null;
  const motionQuery =
    typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  let prefersReduced = motionQuery?.matches ?? false;
  const applyPose = (): void => {
    const zP = clamp(sZoom.position, 0, 1);
    const swP = clamp(sSwap.position, 0, 1);
    lastView = applyStudioCameraPose({
      camera,
      lookTarget,
      px: prefersReduced ? 0 : sx.position,
      py: prefersReduced ? 0 : sy.position,
      zSmooth: zP * zP * (3 - 2 * zP),
      swSmooth: swP * swP * (3 - 2 * swP),
      studioRadius: st.radius,
      studioDistScale: sDist.position,
      studioYaw: sYaw.position,
      studioPitch: sPitch.position,
      prevPose,
      nextPose,
      prevView,
      fYaw: fYaw.position,
      fPitch: fPitch.position,
      fDist: fDist.position,
      halfFovFactor,
      aspectRatio: st.aspect,
      chairBreath: breath,
      vel: prefersReduced
        ? undefined
        : [sZoom.velocity, sSwap.velocity, sYaw.velocity, fYaw.velocity],
    });
  };
  const snapSprings = (): void => {
    st.intro = false;
    snapSpringAxes(allMotionAxes);
    applyPose();
  };
  const onMotionChange = (): void => {
    prefersReduced = motionQuery?.matches ?? false;
    if (!prefersReduced) return;
    for (const ax of [sx, sy]) resetSpringAxis(ax);
    [sYaw.target, sPitch.target] = [yaw0, elev0];
    snapSprings();
  };
  motionQuery?.addEventListener("change", onMotionChange);
  const resize = (widthPx: number, heightPx: number): void => {
    st.aspect = camera.aspect = Math.max(1, widthPx) / Math.max(1, heightPx);
    st.radius = halfFovFactor * Math.max(w.frameHeightUnits, w.frameWidthUnits / st.aspect);
    applyPose();
    camera.updateProjectionMatrix();
  };
  const setPointerTarget = (nx: number, ny: number): void => {
    [sx.target, sy.target] = [clamp(nx, -1, 1), clamp(ny, -1, 1)];
  };
  const addOrbitDelta = (dYaw: number, dPitch: number): void => {
    st.intro = false;
    const prop = activeFocus !== null && nextPose.allowOrbit;
    if (prop && nextPose.firstPerson) {
      applySeatedLookDelta(fYaw, fPitch, nextPose.elevRad, dYaw, dPitch, breath);
    } else {
      const [yawAx, pitchAx] = prop ? [fYaw, fPitch] : [sYaw, sPitch];
      const lo = prop ? 0.06 - nextPose.elevRad : STUDIO_CAM.minPitch;
      const hi = prop ? 1.32 - nextPose.elevRad : STUDIO_CAM.maxPitch;
      yawAx.target += dYaw;
      pitchAx.target = clamp(pitchAx.target + dPitch, lo, hi);
    }
    if (prefersReduced) snapSprings();
  };
  const addDistanceScaleDelta = (factorDelta: number): void => {
    st.intro = false;
    const prop = activeFocus !== null && nextPose.allowOrbit;
    const lo = prop ? (nextPose.firstPerson ? 0.56 : 0.62) : STUDIO_CAM.minZoomScale;
    const hi = prop ? (nextPose.firstPerson ? 1.3 : 1.55) : STUDIO_CAM.maxZoomScale;
    const ax = prop ? fDist : sDist;
    ax.target = clamp(ax.target * Math.exp(factorDelta), lo, hi);
    if (prefersReduced) snapSprings();
  };
  const cycleShowcaseAngle = (): void => {
    st.intro = false;
    st.idx = (st.idx + 1) % SHOWCASE_ANGLES.length;
    const nextAngle = SHOWCASE_ANGLES[st.idx] ?? STUDIO_WORLD.initialOrbitYawRad;
    sYaw.target += wrapAngle(nextAngle - wrapAngle(sYaw.target));
    sPitch.target = STUDIO_WORLD.baseElevationRad;
    if (prefersReduced) snapSprings();
  };
  const playIntroOrbit = (): void => {
    [st.idx, st.elapsed, activeFocus, st.intro] = [0, 0, null, !prefersReduced];
    breath.reset();
    resetSpringAxis(sDist, prefersReduced ? 1 : STUDIO_CAM.introDistScale);
    resetSpringAxis(sPitch, prefersReduced ? elev0 : w.introElevationRad);
    resetSpringAxis(sYaw, prefersReduced ? yaw0 : w.introOrbitYawRad);
    applyPose();
  };
  const isFocusSettled = (): boolean =>
    activeFocus !== null && sZoom.position >= 0.985 && sSwap.position >= 0.985;
  const setFocusTarget = (target: StudioFocusTarget | null): void => {
    if (st.intro && target) [sYaw.target, sPitch.target, sDist.target] = [yaw0, elev0, 1];
    st.intro = false;
    activeFocus = target;
    breath.reset();
    if (target === null) {
      if (sSwap.position > 0.99) [prevPose, prevView] = [nextPose, null];
      sZoom.target = 0;
      if (prefersReduced) snapSprings();
      return;
    }
    const resolved = resolveStudioFocusPose(target);
    const alreadyFocused = sZoom.position > 0.05;
    prevPose = alreadyFocused ? nextPose : resolved;
    prevView = alreadyFocused && (prevPose.firstPerson || resolved.firstPerson) ? lastView : null;
    nextPose = resolved;
    resetSpringAxis(sSwap, alreadyFocused ? 0 : 1);
    for (const ax of [fYaw, fPitch]) resetSpringAxis(ax);
    resetSpringAxis(fDist, 1);
    [sSwap.target, sZoom.target] = [1, 1];
    if (prefersReduced) snapSprings();
  };
  const update = (dtSeconds: number): boolean => {
    if (prefersReduced) return false;
    const dt = clamp(dtSeconds, 0, 0.05);
    const { orbitOmega: ow, zoomOmega: zw } = STUDIO_CAM;
    let moved =
      stepSpringGroup([sx, sy], dt) +
      stepSpringGroup([fYaw, fPitch, fDist], dt, ow) +
      stepSpringGroup([sZoom, sSwap], dt, zw) +
      Number(breath.step(dt, activeFocus === "chair", isFocusSettled()));
    if (st.intro) {
      const prevElapsed = st.elapsed;
      st.elapsed += dt;
      st.intro = applyIntroOrbitStep(sYaw, sPitch, sDist, st.elapsed);
      if (st.elapsed >= STUDIO_CAM.introHoldSec || prevElapsed === 0) moved += 1;
    } else moved += stepSpringGroup([sYaw, sPitch, sDist], dt, ow);
    if (moved > 0) applyPose();
    return moved > 0 || st.intro;
  };
  applyPose();
  return {
    camera,
    resize,
    setPointerTarget,
    addOrbitDelta,
    addDistanceScaleDelta,
    cycleShowcaseAngle,
    playIntroOrbit,
    isIntroActive: () => st.intro,
    setFocusTarget,
    getZoomProgress: () => clamp(sZoom.position, 0, 1),
    isFocusSettled,
    isChairCueReady: () =>
      activeFocus === "chair" && (prefersReduced ? isFocusSettled() : breath.isCueReady()),
    update,
    getSmoothedPointer: () => ({
      x: prefersReduced ? 0 : sx.position,
      y: prefersReduced ? 0 : sy.position,
    }),
    dispose: () => motionQuery?.removeEventListener("change", onMotionChange),
  };
};
