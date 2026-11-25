import { MathUtils, type PerspectiveCamera, type Vector3 } from "three";
import { STUDIO_CAM, STUDIO_WORLD, type StudioSpringAxis } from "./studio.types";
import {
  applyCameraView,
  blendStudioCameraViews,
  evaluateSeatedChairView,
  type StudioCameraView,
  type StudioChairBreathHandle,
} from "./studio-chair-view";
import type { StudioFocusCameraPose } from "./studio-prop-focus";

export const SHOWCASE_ANGLES: readonly number[] = [0.34, 2.45, -2.38, -0.2, 0];

export const makeSpring = (v = 0): StudioSpringAxis => ({ position: v, velocity: 0, target: v });

export const snapSpringAxes = (axes: readonly StudioSpringAxis[]): void => {
  for (const a of axes) [a.position, a.velocity] = [a.target, 0];
};

export const resetSpringAxis = (a: StudioSpringAxis, v = 0): void => {
  [a.position, a.target, a.velocity] = [v, v, 0];
};

export const wrapAngle = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));

const easeIntroArc = (t: number): number => {
  const q = 1 - t;
  return 1 - q * q * q * (1 + 3 * t);
};

export const applyIntroOrbitStep = (
  sYaw: StudioSpringAxis,
  sPitch: StudioSpringAxis,
  sDist: StudioSpringAxis,
  elapsedSec: number,
): boolean => {
  const { clamp, lerp } = MathUtils;
  const t = clamp((elapsedSec - STUDIO_CAM.introHoldSec) / STUDIO_CAM.introSweepSec, 0, 1);
  const ease = easeIntroArc(t);
  const settle = t * t * t * (t * (t * 6 - 15) + 10);
  resetSpringAxis(sYaw, lerp(STUDIO_WORLD.introOrbitYawRad, STUDIO_WORLD.initialOrbitYawRad, ease));
  resetSpringAxis(
    sPitch,
    lerp(STUDIO_WORLD.introElevationRad, STUDIO_WORLD.baseElevationRad, settle),
  );
  resetSpringAxis(sDist, lerp(STUDIO_CAM.introDistScale, 1, ease));
  return t < 1;
};

const stepSpringAxis = (
  axis: StudioSpringAxis,
  dt: number,
  omega: number = STUDIO_CAM.springOmega,
): boolean => {
  const disp = axis.position - axis.target;
  if (Math.abs(disp) < STUDIO_CAM.restEps && Math.abs(axis.velocity) < STUDIO_CAM.restEps) {
    [axis.position, axis.velocity] = [axis.target, 0];
    return false;
  }
  const decay = Math.exp(-omega * dt);
  const vTerm = axis.velocity + omega * disp;
  axis.position = axis.target + (disp + vTerm * dt) * decay;
  axis.velocity = (axis.velocity - omega * vTerm * dt) * decay;
  return true;
};

export const stepSpringGroup = (
  axes: readonly StudioSpringAxis[],
  dt: number,
  omega: number = STUDIO_CAM.springOmega,
): number => {
  let moved = 0;
  for (const axis of axes) if (stepSpringAxis(axis, dt, omega)) moved += 1;
  return moved;
};

interface StudioPoseApplyInput {
  readonly camera: PerspectiveCamera;
  readonly lookTarget: Vector3;
  readonly px: number;
  readonly py: number;
  readonly zSmooth: number;
  readonly swSmooth: number;
  readonly studioRadius: number;
  readonly studioDistScale: number;
  readonly studioYaw: number;
  readonly studioPitch: number;
  readonly prevPose: StudioFocusCameraPose;
  readonly nextPose: StudioFocusCameraPose;
  readonly prevView: StudioCameraView | null;
  readonly fYaw: number;
  readonly fPitch: number;
  readonly fDist: number;
  readonly halfFovFactor: number;
  readonly aspectRatio: number;
  readonly chairBreath?: StudioChairBreathHandle;
  readonly vel?: readonly [number, number, number, number];
}

const applyOpticalMotion = (
  v: StudioCameraView,
  vel?: readonly [number, number, number, number],
): StudioCameraView => {
  if (!vel) return v;
  const [zv, swv, yv, fyv] = vel;
  const df = Math.min(3.6, Math.abs(zv) * 2.1 + Math.abs(swv) * 1.9 + Math.abs(yv) * 0.45);
  const dr = MathUtils.clamp(-yv * 0.0085 - fyv * 0.006, -0.022, 0.022);
  return df < 0.005 && Math.abs(dr) < 0.0002
    ? v
    : { ...v, fovDeg: MathUtils.clamp(v.fovDeg + df, 38, 98), rollRad: v.rollRad + dr };
};

const fitPoseRadius = (p: StudioFocusCameraPose, halfFov: number, aspect: number): number =>
  Math.max(p.frameHeight * halfFov, (p.frameWidth * halfFov) / aspect);

const buildOrbitView = (
  tx: number,
  ty: number,
  tz: number,
  baseYaw: number,
  baseElev: number,
  radius: number,
  px: number,
  py: number,
  pScale: number,
): StudioCameraView => {
  const yaw = baseYaw + px * STUDIO_CAM.parallaxYaw * pScale;
  const elev = MathUtils.clamp(baseElev + py * STUDIO_CAM.parallaxPitch * pScale, 0.005, 1.4);
  const hDist = radius * Math.cos(elev);
  const camX = tx + hDist * Math.sin(yaw);
  const floorMinY = STUDIO_WORLD.floorY + STUDIO_CAM.floorClearance;
  const camY = Math.max(floorMinY, ty + radius * Math.sin(elev));
  const camZ = tz + hDist * Math.cos(yaw);
  const lx = tx + px * STUDIO_CAM.leadX * pScale * Math.cos(baseYaw);
  const ly = ty + py * STUDIO_CAM.leadY * pScale;
  const lz = tz - px * STUDIO_CAM.leadX * pScale * Math.sin(baseYaw);
  const [dx, dy, dz] = [lx - camX, ly - camY, lz - camZ];
  return {
    camX,
    camY,
    camZ,
    dirYaw: Math.atan2(dx, dz),
    dirPitch: Math.atan2(dy, Math.hypot(dx, dz)),
    fovDeg: STUDIO_WORLD.cameraFovDeg,
    rollRad: -px * STUDIO_CAM.roll * pScale,
  };
};

export const applyStudioCameraPose = (inp: StudioPoseApplyInput): StudioCameraView => {
  const { lerp, clamp } = MathUtils;
  const { camera, lookTarget, px, py, zSmooth, swSmooth, prevPose, nextPose } = inp;
  const { fYaw, fPitch, fDist, halfFovFactor, aspectRatio } = inp;
  const sYaw = wrapAngle(inp.studioYaw);
  const sRad = inp.studioRadius * inp.studioDistScale;
  const tY = STUDIO_WORLD.targetY;
  if (prevPose.firstPerson || nextPose.firstPerson) {
    const studio = buildOrbitView(0, tY, 0, sYaw, inp.studioPitch, sRad, px, py, 1);
    const next = nextPose.firstPerson
      ? evaluateSeatedChairView(nextPose, fYaw, fPitch, fDist, aspectRatio, px, py, inp.chairBreath)
      : buildOrbitView(
          nextPose.targetX,
          nextPose.targetY,
          nextPose.targetZ,
          nextPose.yawRad + fYaw,
          clamp(nextPose.elevRad + fPitch, 0.04, 1.35),
          fitPoseRadius(nextPose, halfFovFactor, aspectRatio) * fDist,
          px,
          py,
          0.14,
        );
    const focus =
      swSmooth < 0.9999 && inp.prevView
        ? blendStudioCameraViews(inp.prevView, next, swSmooth)
        : next;
    const view = zSmooth < 0.9999 ? blendStudioCameraViews(studio, focus, zSmooth) : focus;
    return applyCameraView(camera, lookTarget, applyOpticalMotion(view, inp.vel));
  }
  const fR0 = fitPoseRadius(prevPose, halfFovFactor, aspectRatio);
  const fR1 = fitPoseRadius(nextPose, halfFovFactor, aspectRatio);
  const focusYaw = prevPose.yawRad + wrapAngle(nextPose.yawRad - prevPose.yawRad) * swSmooth + fYaw;
  const focusElev = clamp(
    prevPose.elevRad + (nextPose.elevRad - prevPose.elevRad) * swSmooth + fPitch,
    0.04,
    1.35,
  );
  const view = buildOrbitView(
    lerp(0, lerp(prevPose.targetX, nextPose.targetX, swSmooth), zSmooth),
    lerp(STUDIO_WORLD.targetY, lerp(prevPose.targetY, nextPose.targetY, swSmooth), zSmooth),
    lerp(0, lerp(prevPose.targetZ, nextPose.targetZ, swSmooth), zSmooth),
    lerp(sYaw, sYaw + wrapAngle(focusYaw - sYaw), zSmooth),
    lerp(inp.studioPitch, focusElev, zSmooth),
    lerp(sRad, (fR0 + (fR1 - fR0) * swSmooth) * fDist, zSmooth),
    px,
    py,
    lerp(1, 0.14, zSmooth),
  );
  return applyCameraView(camera, lookTarget, applyOpticalMotion(view, inp.vel));
};
