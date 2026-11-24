import { BoxGeometry, Group, Mesh, MeshBasicMaterial, type Object3D, type Scene } from "three";
import { STUDIO_WORLD } from "./studio.types";

export type StudioFocusPropId = "bust" | "phone" | "thermos" | "clock" | "computer" | "chair";
export type StudioFocusTarget = "tv" | StudioFocusPropId;
export type StudioChairZone = "chair_sit" | "chair_exit";

export interface StudioFocusCameraPose {
  readonly targetX: number;
  readonly targetY: number;
  readonly targetZ: number;
  readonly yawRad: number;
  readonly elevRad: number;
  readonly frameHeight: number;
  readonly frameWidth: number;
  readonly allowOrbit: boolean;
  readonly firstPerson?: boolean;
  readonly wideFovDeg?: number;
  readonly lookDist?: number;
}

interface PropFocusPreset extends StudioFocusCameraPose {
  readonly id: StudioFocusPropId;
  readonly hitCenter: readonly [number, number, number];
  readonly hitSize: readonly [number, number, number];
  readonly hitRotX: number;
  readonly hitRotY: number;
}

const TV_FOCUS_POSE: StudioFocusCameraPose = {
  targetX: 0,
  targetY: STUDIO_WORLD.zoomedTargetY,
  targetZ: STUDIO_WORLD.zoomedTargetZ,
  yawRad: 0,
  elevRad: STUDIO_WORLD.zoomedElevationRad,
  frameHeight: STUDIO_WORLD.zoomedFrameHeightUnits,
  frameWidth: STUDIO_WORLD.zoomedFrameWidthUnits,
  allowOrbit: false,
};

const PROP_PRESETS: readonly PropFocusPreset[] = [
  {
    id: "bust",
    targetX: 2.18,
    targetY: -0.44,
    targetZ: -0.28,
    yawRad: 0.58,
    elevRad: 0.16,
    frameHeight: 2.05,
    frameWidth: 1.65,
    allowOrbit: true,
    hitCenter: [2.18, -0.49, -0.28],
    hitSize: [0.96, 1.68, 1.02],
    hitRotX: 0,
    hitRotY: -0.36,
  },
  {
    id: "thermos",
    targetX: 2.28,
    targetY: -0.62,
    targetZ: 1.05,
    yawRad: 0.03,
    elevRad: 0.068,
    frameHeight: 1.68,
    frameWidth: 1.45,
    allowOrbit: true,
    hitCenter: [2.28, -0.63, 1.05],
    hitSize: [0.68, 1.38, 0.52],
    hitRotX: 0,
    hitRotY: -0.65,
  },
  {
    id: "phone",
    targetX: 1.42,
    targetY: -1.25,
    targetZ: 1.36,
    yawRad: -0.34,
    elevRad: 0.9,
    frameHeight: 1.06,
    frameWidth: 0.88,
    allowOrbit: true,
    hitCenter: [1.42, -1.21, 1.36],
    hitSize: [0.32, 0.14, 0.74],
    hitRotX: 0,
    hitRotY: -0.34,
  },
  {
    id: "clock",
    targetX: -1.84,
    targetY: -0.84,
    targetZ: 0.46,
    yawRad: 0.28,
    elevRad: 0.26,
    frameHeight: 1.54,
    frameWidth: 1.54,
    allowOrbit: true,
    hitCenter: [-1.84, -0.84, 0.46],
    hitSize: [1.0, 1.0, 0.36],
    hitRotX: -0.24,
    hitRotY: 0.28,
  },
  {
    id: "computer",
    targetX: -2.3,
    targetY: -0.7,
    targetZ: -0.3,
    yawRad: -0.46,
    elevRad: 0.24,
    frameHeight: 1.68,
    frameWidth: 1.9,
    allowOrbit: true,
    hitCenter: [-2.32, -0.68, -0.32],
    hitSize: [1.18, 1.18, 0.92],
    hitRotX: 0,
    hitRotY: 0.28,
  },
  {
    id: "chair",
    targetX: -1.98,
    targetY: 0.72,
    targetZ: 4.25,
    yawRad: 2.666,
    elevRad: -0.229,
    frameHeight: 1,
    frameWidth: 1,
    allowOrbit: true,
    firstPerson: true,
    wideFovDeg: 74,
    lookDist: 4.85,
    hitCenter: [-1.88, -3.28, 3.86],
    hitSize: [3.15, 4.68, 3.1],
    hitRotX: 0,
    hitRotY: Math.PI - 0.26,
  },
];

const PRESET_BY_ID: Readonly<Record<StudioFocusPropId, PropFocusPreset>> = {
  bust: PROP_PRESETS[0] as PropFocusPreset,
  thermos: PROP_PRESETS[1] as PropFocusPreset,
  phone: PROP_PRESETS[2] as PropFocusPreset,
  clock: PROP_PRESETS[3] as PropFocusPreset,
  computer: PROP_PRESETS[4] as PropFocusPreset,
  chair: PROP_PRESETS[5] as PropFocusPreset,
};

export const resolveStudioFocusPose = (target: StudioFocusTarget): StudioFocusCameraPose =>
  target === "tv" ? TV_FOCUS_POSE : PRESET_BY_ID[target];

export interface StudioPropHitProxies {
  readonly meshes: readonly Mesh[];
  readonly resolvePropId: (object: Object3D) => StudioFocusPropId | null;
  readonly dispose: () => void;
}

export const createStudioPropHitProxies = (targetScene: Scene): StudioPropHitProxies => {
  const group = new Group();
  group.name = "studioPropHitProxies";
  const proxyMat = new MeshBasicMaterial();
  const geometries: BoxGeometry[] = [];
  const meshes: Mesh[] = [];
  const lookup = new Map<Object3D, StudioFocusPropId>();

  for (const preset of PROP_PRESETS) {
    const [sx, sy, sz] = preset.hitSize;
    const [cx, cy, cz] = preset.hitCenter;
    const geo = new BoxGeometry(sx, sy, sz);
    const mesh = new Mesh(geo, proxyMat);
    mesh.name = `propHit_${preset.id}`;
    mesh.position.set(cx, cy, cz);
    mesh.rotation.set(preset.hitRotX, preset.hitRotY, 0);
    mesh.visible = false;
    mesh.updateMatrix();
    mesh.updateMatrixWorld(true);
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    geometries.push(geo);
    meshes.push(mesh);
    lookup.set(mesh, preset.id);
  }

  targetScene.add(group);
  return {
    meshes,
    resolvePropId: (object) => lookup.get(object) ?? null,
    dispose: () => {
      targetScene.remove(group);
      for (const geo of geometries) geo.dispose();
      proxyMat.dispose();
    },
  };
};
