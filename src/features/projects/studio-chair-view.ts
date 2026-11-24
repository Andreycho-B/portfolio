import { MathUtils, type PerspectiveCamera, type Vector3 } from "three";
import { STUDIO_CAM, STUDIO_WORLD, type StudioSpringAxis } from "./studio.types";
import type { StudioFocusCameraPose } from "./studio-prop-focus";

export interface StudioCameraView {
  readonly camX: number;
  readonly camY: number;
  readonly camZ: number;
  readonly dirYaw: number;
  readonly dirPitch: number;
  readonly fovDeg: number;
  readonly rollRad: number;
}

export interface StudioChairBreathHandle {
  readonly getOffsets: () => {
    readonly pitch: number;
    readonly lift: number;
    readonly fov: number;
  };
  readonly isCueReady: () => boolean;
  readonly step: (dtSeconds: number, seated: boolean, settled: boolean) => boolean;
  readonly cancel: (fPitch: StudioSpringAxis, elevRad: number) => void;
  readonly reset: () => void;
}

const MIN_SEATED_PITCH = -1.08;
const MAX_SEATED_PITCH = 1.18;
const MIN_SEATED_FOV = 42;
const MAX_SEATED_FOV = 96;
const DEFAULT_WIDE_FOV = 74;
const SEATED_PARALLAX_YAW = 0.085;
const SEATED_PARALLAX_PITCH = 0.055;
const PORTRAIT_ASPECT_PIVOT = 1.05;
const PORTRAIT_FOV_GAIN = 26;
const MAX_PORTRAIT_FOV_BOOST = 14;
const ARC_TRAVEL_SPAN = 18;
const ARC_MAX_LIFT = 1.1;
const BREATH_INHALE_SEC = 2.05;
const BREATH_HOLD_END_SEC = 2.52;
const BREATH_TOTAL_SEC = 4.65;
const BREATH_MAX_PITCH = 0.54;
const BREATH_MAX_LIFT = 0.065;
const BREATH_MAX_FOV = 2.2;

const wrapAngle = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));

const sampleBreathCurve = (elapsedSec: number): number => {
  if (elapsedSec <= 0 || elapsedSec >= BREATH_TOTAL_SEC) return 0;
  if (elapsedSec < BREATH_INHALE_SEC) {
    const t = elapsedSec / BREATH_INHALE_SEC;
    return 0.5 - 0.5 * Math.cos(Math.PI * t);
  }
  if (elapsedSec < BREATH_HOLD_END_SEC) {
    const t = (elapsedSec - BREATH_INHALE_SEC) / (BREATH_HOLD_END_SEC - BREATH_INHALE_SEC);
    return 1 - 0.015 * Math.sin(Math.PI * t);
  }
  const t = (elapsedSec - BREATH_HOLD_END_SEC) / (BREATH_TOTAL_SEC - BREATH_HOLD_END_SEC);
  return Math.cos(Math.PI * 0.5 * t) ** 1.45;
};

export const createChairBreathMotion = (): StudioChairBreathHandle => {
  const s = { started: false, active: false, elapsed: 0, pitch: 0, lift: 0, fov: 0 };
  const clearOffsets = (): void => {
    s.pitch = s.lift = s.fov = 0;
  };
  const reset = (): void => {
    s.started = s.active = false;
    s.elapsed = 0;
    clearOffsets();
  };
  return {
    getOffsets: () => ({ pitch: s.pitch, lift: s.lift, fov: s.fov }),
    isCueReady: () => s.started && !s.active,
    step: (dtSeconds, seated, settled) => {
      if (!seated) {
        if (s.started || s.active || s.pitch !== 0) reset();
        return false;
      }
      if (!s.started && settled) {
        s.started = s.active = true;
        s.elapsed = 0;
      }
      if (!s.active) return false;
      s.elapsed += dtSeconds;
      if (s.elapsed >= BREATH_TOTAL_SEC) {
        s.active = false;
        clearOffsets();
        return true;
      }
      const level = sampleBreathCurve(s.elapsed);
      s.pitch = level * BREATH_MAX_PITCH;
      s.lift = level * BREATH_MAX_LIFT;
      s.fov = level * BREATH_MAX_FOV;
      return true;
    },
    cancel: (fPitch, elevRad) => {
      if (!s.active && s.pitch === 0) return;
      const lo = MIN_SEATED_PITCH - elevRad;
      const hi = MAX_SEATED_PITCH - elevRad;
      fPitch.position = MathUtils.clamp(fPitch.position + s.pitch, lo, hi);
      fPitch.target = MathUtils.clamp(fPitch.target + s.pitch, lo, hi);
      s.active = false;
      clearOffsets();
    },
    reset,
  };
};

export const evaluateSeatedChairView = (
  pose: StudioFocusCameraPose,
  fYaw: number,
  fPitch: number,
  fDist: number,
  aspect: number,
  px: number,
  py: number,
  breath?: StudioChairBreathHandle,
): StudioCameraView => {
  const boost = MathUtils.clamp(
    (PORTRAIT_ASPECT_PIVOT - aspect) * PORTRAIT_FOV_GAIN,
    0,
    MAX_PORTRAIT_FOV_BOOST,
  );
  const b = breath?.getOffsets();
  const baseFov = (pose.wideFovDeg ?? DEFAULT_WIDE_FOV) + boost + (b?.fov ?? 0);
  return {
    camX: pose.targetX,
    camY: pose.targetY + (b?.lift ?? 0),
    camZ: pose.targetZ,
    dirYaw: pose.yawRad + fYaw - px * SEATED_PARALLAX_YAW,
    dirPitch: MathUtils.clamp(
      pose.elevRad + fPitch + (b?.pitch ?? 0) + py * SEATED_PARALLAX_PITCH,
      MIN_SEATED_PITCH,
      MAX_SEATED_PITCH,
    ),
    fovDeg: MathUtils.clamp(baseFov * fDist, MIN_SEATED_FOV, MAX_SEATED_FOV),
    rollRad: -px * STUDIO_CAM.roll * 0.85,
  };
};

export const blendStudioCameraViews = (
  a: StudioCameraView,
  b: StudioCameraView,
  t: number,
): StudioCameraView => {
  const travel = Math.hypot(b.camX - a.camX, b.camZ - a.camZ);
  const arcY =
    Math.sin(Math.PI * t) * MathUtils.clamp(travel / ARC_TRAVEL_SPAN, 0, 1) * ARC_MAX_LIFT;
  const floorMinY = STUDIO_WORLD.floorY + STUDIO_CAM.floorClearance;
  return {
    camX: MathUtils.lerp(a.camX, b.camX, t),
    camY: Math.max(floorMinY, MathUtils.lerp(a.camY, b.camY, t) + arcY),
    camZ: MathUtils.lerp(a.camZ, b.camZ, t),
    dirYaw: a.dirYaw + wrapAngle(b.dirYaw - a.dirYaw) * t,
    dirPitch: MathUtils.lerp(a.dirPitch, b.dirPitch, t),
    fovDeg: MathUtils.lerp(a.fovDeg, b.fovDeg, t),
    rollRad: MathUtils.lerp(a.rollRad, b.rollRad, t),
  };
};

export const applyCameraView = (
  camera: PerspectiveCamera,
  lookTarget: Vector3,
  view: StudioCameraView,
): StudioCameraView => {
  camera.position.set(view.camX, view.camY, view.camZ);
  const cosP = Math.cos(view.dirPitch);
  lookTarget.set(
    view.camX + cosP * Math.sin(view.dirYaw),
    view.camY + Math.sin(view.dirPitch),
    view.camZ + cosP * Math.cos(view.dirYaw),
  );
  camera.lookAt(lookTarget);
  camera.rotation.z += view.rollRad;
  if (Math.abs(camera.fov - view.fovDeg) > 0.001) {
    camera.fov = view.fovDeg;
    camera.updateProjectionMatrix();
  }
  return view;
};

export const applySeatedLookDelta = (
  fYaw: StudioSpringAxis,
  fPitch: StudioSpringAxis,
  elevRad: number,
  dYaw: number,
  dPitch: number,
  breath?: StudioChairBreathHandle,
): void => {
  breath?.cancel(fPitch, elevRad);
  fYaw.target -= dYaw;
  fPitch.target = MathUtils.clamp(
    fPitch.target + dPitch,
    MIN_SEATED_PITCH - elevRad,
    MAX_SEATED_PITCH - elevRad,
  );
};
