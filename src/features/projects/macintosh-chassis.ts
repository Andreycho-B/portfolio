import {
  BoxGeometry,
  BufferGeometry,
  Group,
  type Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Scene,
  type Texture,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createMacintoshCrtGlass } from "./macintosh-crt-glass";
import type { MacintoshChassisHandle } from "./studio.types";
import type { StudioFluidWaveVec } from "./studio-crt-fluid-wipe";
import type { StudioAssetTracker } from "./studio-loading-tracker";
import { clampPbrTextureBudget, disposeObject3DResources } from "./studio-texture-budget";
import { createStudioTvButtonCues, type StudioChassisFrame } from "./studio-tv-button-cues";
import { createStudioTvButtons, type TvButtonId } from "./studio-tv-buttons";
import { createStudioTvChannels, type TvChannelMode } from "./studio-tv-channels";
import { createStudioTvDecals } from "./studio-tv-decals";
import { splitRetroTvButtons } from "./studio-tv-mesh-split";

const RETRO_TV_MODEL_URL = "/models3D/tv__old_tv__retro_tv.glb";
const [TV_SCALE, TV_OFFSET_Y, TV_OFFSET_Z] = [1.12, -2.6159, 0.525];
const ZERO_WAVE: StudioFluidWaveVec = [0, 0, 0, 0];

export const createMacintoshChassis = (
  targetScene: Scene,
  tDrum: Texture,
  tEditorial: Texture,
  tPortal: Texture,
  onGeometryReady?: () => void,
  onChannelReady?: () => void,
  tracker?: StudioAssetTracker,
): MacintoshChassisHandle => {
  const group = new Group();
  let isDisposed = false;
  let webPortalActive = false;
  let hoveredBtn: TvButtonId | null = null;

  const fallbackMaterial = new MeshStandardMaterial({
    color: 0xeaecef,
    roughness: 0.56,
    metalness: 0.06,
  });
  const chassisBodyMesh = new Mesh(new BufferGeometry(), fallbackMaterial);
  chassisBodyMesh.name = "retroTvBody";
  chassisBodyMesh.visible = false;
  chassisBodyMesh.castShadow = chassisBodyMesh.receiveShadow = true;

  const proxyMat = new MeshBasicMaterial();
  const hullGeo = new BoxGeometry(2.34, 2.26, 2.02);
  const tvHitHull = new Mesh(hullGeo, proxyMat);
  tvHitHull.position.set(0, -0.15, -0.16);
  tvHitHull.visible = false;
  tvHitHull.updateMatrix();
  tvHitHull.updateMatrixWorld(true);
  tvHitHull.matrixAutoUpdate = false;

  const tvButtons = createStudioTvButtons(group);
  const tvDecals = createStudioTvDecals();
  const tvButtonCues = createStudioTvButtonCues(group);
  const tvChannels = createStudioTvChannels(onChannelReady);
  const crtGlass = createMacintoshCrtGlass(tDrum, tEditorial, tPortal);
  group.add(chassisBodyMesh, tvDecals.brandMesh, tvHitHull, crtGlass.mesh);
  targetScene.add(group);

  const loadedGeometries: BufferGeometry[] = [hullGeo];
  const loadedMaterials = new Set<Material>([fallbackMaterial, proxyMat]);
  const loadedTextures = new Set<Texture>();
  const placementMatrix = new Matrix4()
    .makeTranslation(0, TV_OFFSET_Y, TV_OFFSET_Z)
    .multiply(new Matrix4().makeScale(TV_SCALE, TV_SCALE, TV_SCALE))
    .multiply(new Matrix4().makeRotationY(-Math.PI * 0.5));

  const done = tracker?.trackTask(14, "assets", "televisor crt");
  new GLTFLoader(tracker?.manager).load(
    RETRO_TV_MODEL_URL,
    (gltf) => {
      const applyTv = (): void => {
        if (isDisposed) {
          disposeObject3DResources(gltf.scene);
          done?.();
          return;
        }
        gltf.scene.updateMatrixWorld(true);
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
        const combinedMatrix = placementMatrix.clone().multiply(meshNode.matrixWorld);
        const { cabinetGeo, buttonGeos } = splitRetroTvButtons(meshNode.geometry, combinedMatrix);
        for (const [id, geo] of buttonGeos) tvDecals.prepareButton(id, geo);
        chassisBodyMesh.geometry.dispose();
        chassisBodyMesh.geometry = cabinetGeo;
        chassisBodyMesh.visible = true;
        chassisBodyMesh.updateMatrix();
        chassisBodyMesh.updateMatrixWorld(true);
        chassisBodyMesh.matrixAutoUpdate = false;
        loadedGeometries.push(cabinetGeo);

        const mat = Array.isArray(meshNode.material) ? meshNode.material[0] : meshNode.material;
        if (mat instanceof MeshStandardMaterial) {
          mat.envMapIntensity = 0.92;
          const maps = [mat.map, mat.roughnessMap, mat.metalnessMap, mat.normalMap, mat.aoMap];
          for (const tex of maps) {
            if (!tex) continue;
            clampPbrTextureBudget(tex, 1024);
            tex.anisotropy = tex === mat.map ? 8 : 4;
            loadedTextures.add(tex);
          }
          tvDecals.scrubCabinetBrand(mat);
          chassisBodyMesh.material = mat;
          loadedMaterials.add(mat);
          if (mat.roughnessMap) crtGlass.setRoughnessMap(mat.roughnessMap);
        }
        tvButtons.bindVisuals(buttonGeos, tvDecals.buttonMaterial);
        meshNode.geometry.dispose();
        onGeometryReady?.();
        done?.();
      };
      if (tracker) tracker.enqueuePostLoad(applyTv);
      else applyTv();
    },
    undefined,
    (err) => {
      console.warn("[MacintoshChassis] Failed to load Retro TV GLB:", err);
      done?.();
    },
  );

  const syncChannelOverlay = (): void => {
    if (webPortalActive) return;
    const retro = tvChannels.isRetroActive();
    crtGlass.setChannelTexture(retro ? tvChannels.texture : null);
    crtGlass.setPortalState(retro ? 1 : 0, 0, ZERO_WAVE);
  };
  const setPortalState = (mode: number, cutout: number, wave: StudioFluidWaveVec): void => {
    webPortalActive = mode > 0.5 || cutout > 0.01;
    if (webPortalActive) {
      crtGlass.setChannelTexture(null);
      crtGlass.setPortalState(mode, cutout, wave);
    } else syncChannelOverlay();
  };
  const setTvChannel = (mode: TvChannelMode): void => {
    tvChannels.setChannel(mode);
    syncChannelOverlay();
  };

  const update = (dt: number, frame: StudioChassisFrame): boolean => {
    const btnAnim = tvButtons.update(dt);
    const closeView = frame.focus === "tv" || frame.focus === "chair";
    const chAnim = !webPortalActive && tvChannels.update(dt, frame.power > 0.5, closeView);
    const cueAnim = tvButtonCues.update(dt, frame, {
      channel: tvChannels.getChannel(),
      isPortalOpen: webPortalActive,
      hoveredButton: hoveredBtn,
      getPressDepth: tvButtons.getPressDepth,
    });
    return btnAnim || chAnim || cueAnim;
  };

  const dispose = (): void => {
    isDisposed = true;
    targetScene.remove(group);
    const rs = [tvButtons, tvDecals, tvButtonCues, tvChannels, crtGlass, chassisBodyMesh.geometry];
    for (const r of rs) r.dispose();
    for (const r of [...loadedGeometries, ...loadedMaterials, ...loadedTextures]) r.dispose();
  };

  return {
    group,
    lightSurfaceMeshes: [crtGlass.mesh],
    darkSurfaceMeshes: [tvHitHull, ...tvButtons.hitMeshes],
    crtGlassMesh: crtGlass.mesh,
    tvButtons,
    setPortalState,
    setTvChannel,
    getTvChannel: tvChannels.getChannel,
    setHoveredTvButton: (id) => {
      hoveredBtn = id;
    },
    setTitleFade: crtGlass.setTitleFade,
    setDrumUvScale: crtGlass.setDrumUvScale,
    updatePointer: crtGlass.updatePointer,
    updatePower: crtGlass.updatePower,
    setPowerButtonDepth: tvButtons.setPowerDepth,
    update,
    dispose,
  };
};
