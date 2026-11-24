import type { Group, Mesh, PerspectiveCamera, Scene, ShaderMaterial, SphereGeometry } from "three";
import type { AudioEngineContract } from "../../core/audio.types";
import type { CursorController } from "../../design-system/components/cursor-controller";
import type { DrumAutoplayController } from "./drum-autoplay";
import type { DrumScrollPhysics } from "./drum-scroll-physics";
import type { StudioFluidWaveVec } from "./studio-crt-fluid-wipe";
import type { StudioHotspotId } from "./studio-hotspots-shader";
import type { StudioLoadProgress } from "./studio-loading-tracker";
import type { NokiaScreenZone, StudioSceneNokiaApi } from "./studio-nokia-screen";
import type { StudioPowerController } from "./studio-power-state";
import type { StudioChairZone, StudioFocusPropId, StudioFocusTarget } from "./studio-prop-focus";
import type { StudioChassisFrame } from "./studio-tv-button-cues";
import type { StudioSceneTvApi, StudioTvButtonsHandle, TvButtonId } from "./studio-tv-buttons";
import type { TvChannelMode } from "./studio-tv-channels";

export type StudioPointerNormalized = { readonly x: number; readonly y: number };
export type StudioViewportSize = { readonly widthPx: number; readonly heightPx: number };

type TvScreenZone = "power" | "tv_button" | "tv_channel_exit" | "screen_zoom" | "bezel_exit";
type CrtHudZone = "card" | "step_prev" | "step_next" | "about" | "sound" | "phone" | "email";
type PropZone = "none" | "prop_zoom" | "prop_exit" | StudioChairZone | NokiaScreenZone;
export type StudioScreenZone = TvScreenZone | CrtHudZone | PropZone;

export interface StudioSpringAxis {
  position: number;
  velocity: number;
  target: number;
}

export interface StudioCameraState {
  readonly camera: PerspectiveCamera;
  readonly resize: (widthPx: number, heightPx: number) => void;
  readonly setPointerTarget: (nx: number, ny: number) => void;
  readonly addOrbitDelta: (deltaYawRad: number, deltaPitchRad: number) => void;
  readonly addDistanceScaleDelta: (factorDelta: number) => void;
  readonly cycleShowcaseAngle: () => void;
  readonly playIntroOrbit: () => void;
  readonly isIntroActive: () => boolean;
  readonly setFocusTarget: (target: StudioFocusTarget | null) => void;
  readonly getZoomProgress: () => number;
  readonly isFocusSettled: () => boolean;
  readonly isChairCueReady: () => boolean;
  readonly update: (dtSeconds: number) => boolean;
  readonly getSmoothedPointer: () => StudioPointerNormalized;
  readonly dispose: () => void;
}

export interface StudioSkyDomeHandle {
  readonly mesh: Mesh;
  readonly geometry: SphereGeometry;
  readonly material: ShaderMaterial;
  readonly updateTime: (dtSeconds: number) => boolean;
  readonly dispose: () => void;
}

export interface StudioEnvironmentHandle {
  readonly updatePointerLight: (nx: number, ny: number) => void;
  readonly updateSkyTime: (dt: number, zoom?: number, focus?: StudioFocusTarget | null) => boolean;
  readonly dispose: () => void;
}

export interface StudioTableHandle {
  readonly tableMesh: Mesh;
  readonly woodenTableMesh: Mesh;
  readonly isPointInShadowCore: (worldX: number, worldZ: number) => boolean;
  readonly updatePointer: (nx: number, ny: number) => void;
  readonly dispose: () => void;
}

export interface MacintoshChassisHandle {
  readonly group: Group;
  readonly lightSurfaceMeshes: readonly Mesh[];
  readonly darkSurfaceMeshes: readonly Mesh[];
  readonly powerButtonMesh: Mesh;
  readonly crtGlassMesh: Mesh;
  readonly tvButtons: StudioTvButtonsHandle;
  readonly setPortalState: (mode: number, cutout: number, wave: StudioFluidWaveVec) => void;
  readonly setTvChannel: (mode: TvChannelMode) => void;
  readonly getTvChannel: () => TvChannelMode;
  readonly setHoveredTvButton: (id: TvButtonId | null) => void;
  readonly setTitleFade: (fade: number) => void;
  readonly setDrumUvScale: (scale: number) => void;
  readonly updatePointer: (nx: number, ny: number) => void;
  readonly updatePower: (power: number) => void;
  readonly setPowerButtonDepth: (pressedRatio: number) => void;
  readonly update: (dtSeconds: number, frame: StudioChassisFrame) => boolean;
  readonly dispose: () => void;
}

export interface StudioSceneHandle extends StudioSceneNokiaApi, StudioSceneTvApi {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly setPointerNormalized: (nx: number, ny: number) => void;
  readonly setGlassPointer: (nx: number, ny: number) => void;
  readonly addOrbitDelta: (deltaYawRad: number, deltaPitchRad: number) => void;
  readonly addDistanceScaleDelta: (factorDelta: number) => void;
  readonly cycleShowcaseAngle: () => void;
  readonly playIntroOrbit: () => void;
  readonly isIntroActive: () => boolean;
  readonly setFocusTarget: (target: StudioFocusTarget | null) => void;
  readonly setTvPortalState: (
    mode: number,
    cutout: number,
    wave: StudioFluidWaveVec,
    isAboutPortal?: boolean,
  ) => void;
  readonly capturePortalSnapshot: (iframe: HTMLIFrameElement) => boolean;
  readonly getZoomProgress: () => number;
  readonly isFocusSettled: () => boolean;
  readonly pickScreenUv: (nx: number, ny: number) => StudioPointerNormalized | null;
  readonly pickFocusProp: (nx: number, ny: number) => StudioFocusPropId | null;
  readonly setHoveredHotspot: (target: StudioHotspotId | null) => void;
  readonly setEmailCopied: (copied: boolean) => void;
  readonly isPointerOverDarkSurface: (nx: number, ny: number) => boolean;
  readonly isPointerOverPowerButton: (nx: number, ny: number) => boolean;
  readonly setPowerState: (powerProgress: number, buttonDepressed: number) => void;
  readonly setDrumState: (
    angleRad: number,
    scrollVelocity: number,
    introProgress: number,
    activeIndex: number,
    soundEnabled: boolean,
  ) => void;
  readonly update: (dtSeconds: number) => boolean;
  readonly isSkyAnimated: () => boolean;
  readonly getLoadProgress: () => StudioLoadProgress;
  readonly onLoadProgress: (listener: (state: StudioLoadProgress) => void) => () => void;
  readonly whenReady: () => Promise<void>;
  readonly resize: (widthPx: number, heightPx: number) => void;
  readonly render: () => void;
  readonly dispose: () => void;
}

export interface StudioInputDeps {
  readonly canvas: HTMLCanvasElement;
  readonly scene: StudioSceneHandle;
  readonly physics: DrumScrollPhysics;
  readonly autoplay: DrumAutoplayController;
  readonly power: StudioPowerController;
  readonly audio: AudioEngineContract;
  readonly cursor: CursorController;
  readonly getFocusTarget: () => StudioFocusTarget | null;
  readonly getActiveIndex: () => number;
  readonly isTvPortalOpen: () => boolean;
  readonly openInTv: (targetUrl: string) => void;
  readonly closeTvPortal: () => void;
  readonly setFocusTarget: (target: StudioFocusTarget | null) => void;
  readonly setDragging: (dragging: boolean) => void;
  readonly updatePointerHover: (nx: number, ny: number, clearHover?: boolean) => void;
  readonly onPointerLeave: () => void;
  readonly refreshHud: () => void;
  readonly requestFrame: () => void;
}

export const STUDIO_CAM = {
  springOmega: 4.6,
  orbitOmega: 7.2,
  zoomOmega: 5.2,
  restEps: 0.00025,
  parallaxYaw: 0.16,
  parallaxPitch: 0.06,
  minPitch: 0.04,
  maxPitch: 0.9,
  minZoomScale: 0.42,
  maxZoomScale: 1.85,
  floorClearance: 0.65,
  leadX: 0.065,
  leadY: 0.03,
  roll: 0.006,
  introHoldSec: 0.18,
  introSweepSec: 2.15,
} as const;

export const STUDIO_WORLD = {
  backgroundHex: 0xf5f5f3,
  tableY: -1.3,
  floorY: -5.657,
  tableBackHalfW: 3.08,
  tableFrontHalfW: 5.2,
  tableBackZ: -3.65,
  tableFrontZ: 3.15,
  cameraFovDeg: 45,
  cameraNear: 0.1,
  cameraFar: 120,
  targetY: -1.65,
  baseElevationRad: 0.56,
  introElevationRad: 0.34,
  initialOrbitYawRad: -0.2,
  introOrbitYawRad: 2.45,
  frameHeightUnits: 8.6,
  frameWidthUnits: 9.2,
  zoomedFrameHeightUnits: 2.22,
  zoomedFrameWidthUnits: 2.52,
  zoomedTargetY: 0.06,
  zoomedTargetZ: 1.1,
  zoomedElevationRad: 0.015,
} as const;
