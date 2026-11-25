import {
  Box3,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  type Texture,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { StudioAssetTracker } from "./studio-loading-tracker";
import { disposeObject3DResources, tuneDeskPropMaterial } from "./studio-texture-budget";

const MONSTERA_URL = "/models3D/monstera_deliciosa_potted_mid-century_plant/scene.gltf";
const MONSTERA_TARGET_HEIGHT = 6.15;
const MONSTERA_POS_X = 4.35;
const MONSTERA_POS_Z = -1.25;
const MONSTERA_ROT_Y = -0.78;

interface StudioMonsteraPlantHandle {
  readonly dispose: () => void;
}

export const createStudioMonsteraPlant = (
  parentGroup: Group,
  floorY: number,
  onAssetLoaded?: () => void,
  tracker?: StudioAssetTracker,
): StudioMonsteraPlantHandle => {
  const holder = new Group();
  holder.name = "studioMonsteraPlant";
  parentGroup.add(holder);

  let isDisposed = false;
  let loadedModel: Group | null = null;
  const materials = new Set<Material>();
  const textures = new Set<Texture>();

  const done = tracker?.trackTask(6, "assets", "planta monstera");
  const loader = new GLTFLoader(tracker?.manager);

  loader.load(
    MONSTERA_URL,
    (gltf) => {
      const attach = (): void => {
        if (isDisposed) {
          disposeObject3DResources(gltf.scene);
          done?.();
          return;
        }
        const model = gltf.scene;
        model.updateMatrixWorld(true);
        model.traverse((node) => {
          if (!(node instanceof Mesh)) return;
          const isArr = Array.isArray(node.material);
          const mats: readonly Material[] = isArr ? node.material : [node.material];
          const tuned = mats.map((m) => {
            const res = tuneDeskPropMaterial(
              m,
              { envIntensity: 0.54, colorCap: 1024 },
              materials,
              textures,
            );
            if (res.material instanceof MeshStandardMaterial && res.material.aoMap) {
              textures.add(res.material.aoMap);
            }
            return res;
          });
          node.material = isArr
            ? tuned.map((r) => r.material)
            : (tuned[0]?.material ?? node.material);
          node.castShadow = true;
          node.receiveShadow = true;
        });

        const bounds = new Box3().setFromObject(model);
        const size = bounds.getSize(new Vector3());
        const center = bounds.getCenter(new Vector3());
        const scale = MONSTERA_TARGET_HEIGHT / Math.max(0.001, size.y);

        const pivot = new Group();
        pivot.add(model);
        pivot.position.set(-center.x, -bounds.min.y, -center.z);

        const placed = new Group();
        placed.name = "monsteraMidCenturyPot";
        placed.add(pivot);
        placed.scale.setScalar(scale);
        placed.rotation.y = MONSTERA_ROT_Y;
        placed.position.set(MONSTERA_POS_X, floorY, MONSTERA_POS_Z);
        placed.updateMatrixWorld(true);
        placed.traverse((node) => {
          node.updateMatrix();
          node.matrixAutoUpdate = false;
        });

        loadedModel = placed;
        holder.add(placed);
        onAssetLoaded?.();
        done?.();
      };
      if (tracker) tracker.enqueuePostLoad(attach);
      else attach();
    },
    undefined,
    (err) => {
      console.warn("[StudioMonsteraPlant] Failed to load Monstera glTF:", err);
      done?.();
    },
  );

  return {
    dispose: () => {
      isDisposed = true;
      if (loadedModel) disposeObject3DResources(loadedModel);
      parentGroup.remove(holder);
      for (const res of [...materials, ...textures]) res.dispose();
    },
  };
};
