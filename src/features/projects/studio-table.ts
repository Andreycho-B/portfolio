import {
  BufferGeometry,
  Group,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type Scene,
  type Texture,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { STUDIO_WORLD, type StudioTableHandle } from "./studio.types";
import { bakeFloorAo, bakeTableContactAo } from "./studio-contact-ao";
import type { StudioAssetTracker } from "./studio-loading-tracker";
import { createStudioQuartzPlatform } from "./studio-quartz-platform";
import { clampPbrTextureBudget, disposeObject3DResources } from "./studio-texture-budget";

const WOODEN_TABLE_URL = "/models3D/wooden_table_02_2k.gltf/wooden_table_02_2k.gltf";
const MONOBLOC_CHAIR_URL =
  "/models3D/plastic_monobloc_chair_01_2k.gltf/plastic_monobloc_chair_01_2k.gltf";
const FURNITURE_SCALE = 5.45;
const FLOOR_Y = STUDIO_WORLD.tableY - 0.799418 * FURNITURE_SCALE;

const freezeTransform = (mesh: Mesh): void => {
  mesh.updateMatrix();
  mesh.updateMatrixWorld(true);
  mesh.matrixAutoUpdate = false;
};

export const createStudioTable = (
  targetScene: Scene,
  onAssetLoaded?: () => void,
  tracker?: StudioAssetTracker,
): StudioTableHandle => {
  const group = new Group();
  let isDisposed = false;

  const quartzPlatform = createStudioQuartzPlatform(FLOOR_Y);
  const floorAoTex = bakeFloorAo();
  const tableAoTex = bakeTableContactAo();

  const floorAoGeo = new PlaneGeometry(10.6, 9.8, 1, 1);
  const floorAoMat = new MeshBasicMaterial({
    map: floorAoTex,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const floorAoMesh = new Mesh(floorAoGeo, floorAoMat);
  floorAoMesh.rotation.x = -Math.PI * 0.5;
  floorAoMesh.position.set(-0.25, FLOOR_Y + 0.003, 0.75);
  freezeTransform(floorAoMesh);

  const fallbackMat = new MeshStandardMaterial({ color: 0x6b462a, roughness: 0.65 });
  const woodenTableMesh = new Mesh(new BufferGeometry(), fallbackMat);
  woodenTableMesh.name = "woodenTable";
  woodenTableMesh.visible = false;
  woodenTableMesh.castShadow = woodenTableMesh.receiveShadow = true;
  woodenTableMesh.scale.setScalar(FURNITURE_SCALE);
  woodenTableMesh.position.set(0, FLOOR_Y, 0);

  const chairMesh = new Mesh(new BufferGeometry(), fallbackMat);
  chairMesh.name = "monoblocChair";
  chairMesh.visible = false;
  chairMesh.castShadow = chairMesh.receiveShadow = true;
  chairMesh.scale.setScalar(FURNITURE_SCALE);
  chairMesh.position.set(-1.85, FLOOR_Y, 3.75);
  chairMesh.rotation.y = Math.PI - 0.26;

  const shadowGeo = new PlaneGeometry(6.04, 3.74, 1, 1);
  const shadowMat = new MeshBasicMaterial({
    map: tableAoTex,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const shadowMesh = new Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI * 0.5;
  shadowMesh.position.set(0, STUDIO_WORLD.tableY + 0.003, 0);
  freezeTransform(shadowMesh);

  group.add(quartzPlatform.mesh, floorAoMesh, woodenTableMesh, chairMesh, shadowMesh);
  targetScene.add(group);

  const loadedMats = new Set<Material>([fallbackMat, floorAoMat, shadowMat]);
  const loadedTexs = new Set<Texture>([floorAoTex, tableAoTex]);
  const loader = new GLTFLoader(tracker?.manager);

  const loadSingleMesh = (url: string, targetMesh: Mesh, envIntensity: number): void => {
    const done = tracker?.trackTask(9, "assets", "mobiliario 3d");
    loader.load(
      url,
      (gltf) => {
        const applyMesh = (): void => {
          if (isDisposed) {
            disposeObject3DResources(gltf.scene);
            done?.();
            return;
          }
          let sourceMesh: Mesh | null = null;
          gltf.scene.traverse((node) => {
            if (!sourceMesh && node instanceof Mesh && node.geometry instanceof BufferGeometry) {
              sourceMesh = node;
            }
          });
          if (!sourceMesh) {
            done?.();
            return;
          }
          const meshNode = sourceMesh as Mesh;
          targetMesh.geometry.dispose();
          targetMesh.geometry = meshNode.geometry;
          targetMesh.visible = true;
          freezeTransform(targetMesh);
          const mat = Array.isArray(meshNode.material) ? meshNode.material[0] : meshNode.material;
          if (mat instanceof MeshStandardMaterial) {
            mat.envMapIntensity = envIntensity;
            if (mat.map) {
              clampPbrTextureBudget(mat.map, 1024);
              mat.map.anisotropy = 4;
              loadedTexs.add(mat.map);
            }
            for (const tex of [mat.roughnessMap, mat.metalnessMap, mat.normalMap]) {
              if (!tex) continue;
              clampPbrTextureBudget(tex, 512);
              tex.anisotropy = 2;
              loadedTexs.add(tex);
            }
            targetMesh.material = mat;
            loadedMats.add(mat);
          }
          onAssetLoaded?.();
          done?.();
        };
        if (tracker) tracker.enqueuePostLoad(applyMesh);
        else applyMesh();
      },
      undefined,
      (err) => {
        console.warn(`[StudioTable] Failed to load glTF (${url}):`, err);
        done?.();
      },
    );
  };

  loadSingleMesh(WOODEN_TABLE_URL, woodenTableMesh, 0.65);
  loadSingleMesh(MONOBLOC_CHAIR_URL, chairMesh, 0.72);

  const dispose = (): void => {
    isDisposed = true;
    targetScene.remove(group);
    quartzPlatform.dispose();
    for (const g of [floorAoGeo, shadowGeo, woodenTableMesh.geometry, chairMesh.geometry]) {
      g.dispose();
    }
    for (const p of [...loadedMats, ...loadedTexs]) p.dispose();
  };

  return {
    tableMesh: quartzPlatform.mesh,
    woodenTableMesh,
    isPointInShadowCore: () => false,
    updatePointer: () => {},
    dispose,
  };
};
