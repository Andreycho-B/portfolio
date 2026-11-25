import {
  type Camera,
  Group,
  MathUtils,
  Mesh,
  type Object3D,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from "three";
import { HOTSPOT_FS, HOTSPOT_VS } from "./studio-hotspots-shader";
import { NOKIA_FRONT_Y, type NokiaButtonId, type NokiaMoveDir } from "./studio-nokia-keypad";

export type NokiaScreenMode = "contact" | "snake";
export type NokiaActionResult = "whatsapp" | "copied" | "handled";
export type NokiaScreenZone = "nokia_snake" | "nokia_back" | "nokia_key";

export interface StudioSceneNokiaApi {
  readonly pickNokiaButton: (nx: number, ny: number) => NokiaButtonId | null;
  readonly pressNokiaButton: (id: NokiaButtonId, soundEnabled: boolean) => NokiaActionResult;
  readonly steerNokiaSnake: (dir: NokiaMoveDir, soundEnabled: boolean) => boolean;
  readonly handleNokiaKey: (key: string, soundEnabled: boolean) => boolean;
  readonly setHoveredNokiaButton: (id: NokiaButtonId | null) => void;
  readonly getNokiaMode: () => NokiaScreenMode;
}

export interface StudioNokiaPhoneHandle {
  readonly attachModel: (nokiaRoot: Object3D, parentGroup: Object3D) => Promise<void>;
  readonly getMode: () => NokiaScreenMode;
  readonly setFocused: (focused: boolean) => void;
  readonly setHoveredButton: (id: NokiaButtonId | null) => void;
  readonly getButtonMeshes: () => readonly Mesh[];
  readonly resolveButtonId: (object: Object3D) => NokiaButtonId | null;
  readonly pressButton: (id: NokiaButtonId, soundEnabled: boolean) => NokiaActionResult;
  readonly steerSnake: (dir: NokiaMoveDir, soundEnabled: boolean) => boolean;
  readonly handleKey: (key: string, soundEnabled: boolean) => boolean;
  readonly update: (
    dtSeconds: number,
    soundEnabled: boolean,
    camera: Camera,
    zoomProgress: number,
  ) => boolean;
  readonly dispose: () => void;
}

interface NokiaHotspotSpec {
  readonly id: NokiaButtonId;
  readonly pos: readonly [number, number, number];
  readonly phase: number;
  readonly activeInSnake: boolean;
}

const NOKIA_HOTSPOTS: readonly NokiaHotspotSpec[] = [
  { id: "call", pos: [0, NOKIA_FRONT_Y + 0.022, 0.029], phase: 0.0, activeInSnake: false },
  { id: "snake", pos: [0.068, NOKIA_FRONT_Y + 0.021, 0.064], phase: 2.1, activeInSnake: false },
  { id: "back", pos: [-0.078, NOKIA_FRONT_Y + 0.021, 0.06], phase: 4.2, activeInSnake: true },
];

interface NokiaHotspotItem {
  readonly spec: NokiaHotspotSpec;
  readonly mesh: Mesh;
  readonly mat: ShaderMaterial;
  hover: number;
}

interface StudioNokiaHotspotsHandle {
  readonly root: Group;
  readonly meshes: readonly Mesh[];
  readonly resolveButtonId: (object: Object3D) => NokiaButtonId | null;
  readonly setHovered: (id: NokiaButtonId | null) => void;
  readonly update: (
    dtSeconds: number,
    camera: Camera,
    isFocused: boolean,
    zoomProgress: number,
    inSnakeMode: boolean,
  ) => boolean;
  readonly dispose: () => void;
}

export const createStudioNokiaHotspots = (): StudioNokiaHotspotsHandle => {
  const root = new Group();
  root.name = "nokiaButtonHotspots";
  const geometry = new PlaneGeometry(1, 1);
  const items: NokiaHotspotItem[] = [];
  const lookup = new Map<Object3D, NokiaButtonId>();

  const motionQuery =
    typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  let prefersReduced = motionQuery?.matches ?? false;
  let hoveredId: NokiaButtonId | null = null;
  let elapsed = 0;

  const worldPos = new Vector3();
  const invParentQuat = new Quaternion();

  for (const spec of NOKIA_HOTSPOTS) {
    const mat = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uHover: { value: 0 },
        uOpacity: { value: 0 },
        uPhase: { value: spec.phase },
        uReduced: { value: prefersReduced ? 1 : 0 },
        uHighlight: { value: 0 },
      },
      vertexShader: HOTSPOT_VS,
      fragmentShader: HOTSPOT_FS,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    });
    const mesh = new Mesh(geometry, mat);
    mesh.name = `nokiaHotspot_${spec.id}`;
    mesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    mesh.renderOrder = 12;
    mesh.visible = false;
    root.add(mesh);
    lookup.set(mesh, spec.id);
    items.push({ spec, mesh, mat, hover: 0 });
  }

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
    isFocused: boolean,
    zoomProgress: number,
    inSnakeMode: boolean,
  ): boolean => {
    const dt = Math.min(Math.max(dtSeconds, 0), 0.05);
    if (!prefersReduced) elapsed += dt;
    const focusVis = isFocused ? MathUtils.smoothstep(zoomProgress, 0.45, 0.88) : 0;
    const hoverLerp = prefersReduced ? 1 : 1 - Math.exp(-12 * dt);

    let anyVisible = false;
    let animatingHover = false;
    if (focusVis > 0.004) {
      root.getWorldQuaternion(invParentQuat).invert();
    }

    for (const item of items) {
      const targetHover = hoveredId === item.spec.id ? 1 : 0;
      item.hover += (targetHover - item.hover) * hoverLerp;
      if (Math.abs(targetHover - item.hover) > 0.004) animatingHover = true;
      else item.hover = targetHover;

      const modeVis = !inSnakeMode || item.spec.activeInSnake ? 1 : 0;
      const opacity = focusVis * modeVis;
      const visible = opacity > 0.004;
      item.mesh.visible = visible;
      if (!visible) continue;

      anyVisible = true;
      item.mesh.getWorldPosition(worldPos);
      const dist = camera.position.distanceTo(worldPos);
      item.mesh.scale.setScalar(MathUtils.clamp(dist * 0.036, 0.036, 0.068));
      item.mesh.quaternion.copy(invParentQuat).multiply(camera.quaternion);
      const u = item.mat.uniforms;
      if (u.uTime) u.uTime.value = elapsed;
      if (u.uHover) u.uHover.value = item.hover;
      if (u.uOpacity) u.uOpacity.value = opacity;
    }

    const hiddenTab = typeof document !== "undefined" && document.visibilityState === "hidden";
    return animatingHover || (anyVisible && !prefersReduced && !hiddenTab);
  };

  return {
    root,
    meshes: items.map((item) => item.mesh),
    resolveButtonId: (object) => (object.visible ? (lookup.get(object) ?? null) : null),
    setHovered: (id) => {
      hoveredId = id;
    },
    update,
    dispose: () => {
      motionQuery?.removeEventListener("change", onMotionChange);
      geometry.dispose();
      for (const item of items) item.mat.dispose();
    },
  };
};
