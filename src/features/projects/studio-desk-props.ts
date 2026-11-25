import {
  Box3,
  BufferGeometry,
  Group,
  type Material,
  Mesh,
  type Scene,
  type Texture,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { STUDIO_WORLD } from "./studio.types";
import { createStudioColombiaClock } from "./studio-colombia-clock";
import type { StudioAssetTracker } from "./studio-loading-tracker";
import { createStudioNokiaScreen, type StudioNokiaPhoneHandle } from "./studio-nokia-screen";
import { disposeObject3DResources, tuneDeskPropMaterial } from "./studio-texture-budget";

interface StudioDeskPropsHandle {
  readonly nokia: StudioNokiaPhoneHandle;
  readonly dispose: () => void;
}

interface DeskPropSpec {
  readonly url: string;
  readonly name: string;
  readonly pos: readonly [number, number];
  readonly scale: number;
  readonly rotationX?: number;
  readonly rotationY: number;
  readonly envIntensity?: number;
  readonly optimizeGlass?: boolean;
}

const DESK_PROPS: readonly DeskPropSpec[] = [
  {
    url: "/models3D/old-computer/model/Computer_Blendertest.gltf",
    name: "oldComputerProp",
    pos: [-2.22, -0.32],
    scale: 0.43,
    rotationY: -Math.PI * 0.5 + 0.28,
    envIntensity: 0.85,
    optimizeGlass: true,
  },
  {
    url: "/models3D/wall_clock_2k.gltf/wall_clock_2k.gltf",
    name: "wallClockProp",
    pos: [-1.84, 0.46],
    scale: 2.9,
    rotationX: -0.24,
    rotationY: 0.28,
    envIntensity: 0.9,
    optimizeGlass: true,
  },
  {
    url: "/models3D/marble_bust_01_2k.gltf/marble_bust_01_2k.gltf",
    name: "marbleBustProp",
    pos: [2.18, -0.28],
    scale: 3.15,
    rotationY: -0.36,
  },
  {
    url: "/models3D/modified_thermos_2k.gltf/modified_thermos_2k.gltf",
    name: "thermosProp",
    pos: [2.28, 1.05],
    scale: 4.35,
    rotationY: -0.65,
    envIntensity: 0.92,
  },
  {
    url: "/models3D/old_nokia_phone_low_poly/scene.gltf",
    name: "nokiaPhoneProp",
    pos: [1.42, 1.36],
    scale: 0.00168,
    rotationX: -Math.PI * 0.5,
    rotationY: -0.34,
  },
];

export const createStudioDeskProps = (
  targetScene: Scene,
  onAssetLoaded?: () => void,
  tracker?: StudioAssetTracker,
  onClockTick?: () => void,
): StudioDeskPropsHandle => {
  const root = new Group();
  root.name = "studioDeskProps";
  targetScene.add(root);
  const colombiaClock = createStudioColombiaClock(onClockTick);
  const nokiaScreen = createStudioNokiaScreen(onClockTick);
  let isDisposed = false;
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const loader = new GLTFLoader(tracker?.manager);
  const attachProp = (spec: DeskPropSpec, model: Group, done?: () => void): void => {
    if (isDisposed) {
      disposeObject3DResources(model);
      done?.();
      return;
    }
    model.updateMatrixWorld(true);
    model.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      if (node.geometry instanceof BufferGeometry) geometries.add(node.geometry);
      const isArr = Array.isArray(node.material);
      const mats: readonly Material[] = isArr ? node.material : [node.material];
      const tuned = mats.map((m) =>
        tuneDeskPropMaterial(
          m,
          {
            envIntensity: spec.envIntensity,
            optimizeGlass: spec.optimizeGlass,
            colorCap: 1024,
          },
          materials,
          textures,
        ),
      );
      node.material = isArr ? tuned.map((r) => r.material) : (tuned[0]?.material ?? node.material);
      node.castShadow = tuned.every((r) => r.castsShadow);
      node.receiveShadow = true;
    });
    const pivot = new Group();
    pivot.add(model);
    if (spec.rotationX) pivot.rotation.x = spec.rotationX;
    pivot.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(pivot);
    const center = bounds.getCenter(new Vector3());
    pivot.position.set(-center.x, -bounds.min.y, -center.z);
    const holder = new Group();
    holder.name = spec.name;
    holder.add(pivot);
    holder.scale.setScalar(spec.scale);
    holder.rotation.y = spec.rotationY;
    holder.position.set(spec.pos[0], STUDIO_WORLD.tableY, spec.pos[1]);
    holder.updateMatrixWorld(true);
    if (spec.name === "wallClockProp") colombiaClock.attachModel(model);
    holder.traverse((node) => {
      if (node.name.startsWith("wall_clock_") && node.name.endsWith("_hand")) return;
      node.updateMatrix();
      node.matrixAutoUpdate = false;
    });
    root.add(holder);
    if (spec.name === "nokiaPhoneProp") {
      const hwAnchor = new Group();
      hwAnchor.position.set(spec.pos[0], STUDIO_WORLD.tableY, spec.pos[1]);
      hwAnchor.rotation.y = spec.rotationY;
      hwAnchor.updateMatrix();
      hwAnchor.matrixAutoUpdate = false;
      root.add(hwAnchor);
      void nokiaScreen
        .attachModel(model, hwAnchor)
        .catch((err: unknown) => console.warn("[StudioDeskProps] Nokia hardware error:", err))
        .finally(() => {
          if (!isDisposed) onAssetLoaded?.();
          done?.();
        });
      return;
    }
    onAssetLoaded?.();
    done?.();
  };
  for (const spec of DESK_PROPS) {
    const done = tracker?.trackTask(3, "assets", "objetos de estudio");
    loader.load(
      spec.url,
      (gltf) => {
        const run = (): void => attachProp(spec, gltf.scene, done);
        if (tracker) tracker.enqueuePostLoad(run);
        else run();
      },
      undefined,
      (err) => {
        console.warn(`[StudioDeskProps] Failed to load ${spec.name}:`, err);
        done?.();
      },
    );
  }
  return {
    nokia: nokiaScreen,
    dispose: () => {
      isDisposed = true;
      for (const h of [colombiaClock, nokiaScreen]) h.dispose();
      targetScene.remove(root);
      for (const res of [...geometries, ...materials, ...textures]) res.dispose();
    },
  };
};
