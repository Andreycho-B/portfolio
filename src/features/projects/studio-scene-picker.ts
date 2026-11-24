import {
  type Camera,
  type Intersection,
  type Mesh,
  type Object3D,
  Raycaster,
  Vector2,
} from "three";
import { MACINTOSH_SPEC } from "./macintosh-profile";
import type { StudioPointerNormalized } from "./studio.types";
import type { StudioHotspotsHandle } from "./studio-hotspots";
import type { NokiaButtonId } from "./studio-nokia-hardware";
import type { StudioNokiaPhoneHandle } from "./studio-nokia-screen";
import type { StudioFocusPropId, StudioPropHitProxies } from "./studio-prop-focus";
import type { StudioTvButtonsHandle, TvButtonId } from "./studio-tv-buttons";

export interface StudioScenePickerDeps {
  readonly camera: Camera;
  readonly crtGlassMesh: Mesh;
  readonly powerButtonMesh: Mesh;
  readonly tvButtons: StudioTvButtonsHandle;
  readonly lightSurfaceMeshes: readonly Mesh[];
  readonly darkSurfaceMeshes: readonly Mesh[];
  readonly tableMesh: Mesh;
  readonly woodenTableMesh: Mesh;
  readonly isPointInShadowCore: (x: number, z: number) => boolean;
  readonly propProxies: StudioPropHitProxies;
  readonly hotspots: StudioHotspotsHandle;
  readonly nokia: StudioNokiaPhoneHandle;
}

export interface StudioScenePicker {
  readonly invalidateCache: () => void;
  readonly setExcludedProp: (prop: StudioFocusPropId | null) => void;
  readonly pickScreenUv: (nx: number, ny: number) => StudioPointerNormalized | null;
  readonly pickFocusProp: (nx: number, ny: number) => StudioFocusPropId | null;
  readonly pickNokiaButton: (nx: number, ny: number) => NokiaButtonId | null;
  readonly pickTvButton: (nx: number, ny: number) => TvButtonId | null;
  readonly isPointerOverPowerButton: (nx: number, ny: number) => boolean;
  readonly isPointerOverDarkSurface: (nx: number, ny: number, powerProgress: number) => boolean;
}

export const createStudioScenePicker = (deps: StudioScenePickerDeps): StudioScenePicker => {
  const raycaster = new Raycaster();
  const rayCoords = new Vector2();
  const darkSet = new Set<Object3D>([...deps.darkSurfaceMeshes, deps.woodenTableMesh]);
  const pickTargets: Object3D[] = [
    ...deps.lightSurfaceMeshes,
    ...deps.propProxies.meshes,
    ...darkSet,
  ];
  let activeTargets: Object3D[] = pickTargets;
  let hitCacheKey = "";
  let rayCacheKey = "";
  let cachedHit: Intersection | null = null;

  const syncRay = (nx: number, ny: number, key: string): void => {
    if (key === rayCacheKey) return;
    rayCacheKey = key;
    rayCoords.set(nx, ny);
    raycaster.setFromCamera(rayCoords, deps.camera);
  };

  const makeKey = (nx: number, ny: number): string => {
    const p = deps.camera.position;
    const q = deps.camera.quaternion;
    const m0 = deps.camera.projectionMatrix.elements[0] ?? 1;
    return `${nx.toFixed(4)}|${ny.toFixed(4)}|${p.x.toFixed(3)}|${p.y.toFixed(3)}|${p.z.toFixed(3)}|${q.x.toFixed(3)}|${q.y.toFixed(3)}|${q.z.toFixed(3)}|${q.w.toFixed(3)}|${m0.toFixed(3)}`;
  };

  const pickClosest = (nx: number, ny: number): Intersection | null => {
    const key = makeKey(nx, ny);
    if (key === hitCacheKey) return cachedHit;
    hitCacheKey = key;
    syncRay(nx, ny, key);
    const visibleHotspots = deps.hotspots.meshes.filter((mesh) => mesh.visible);
    const hotspotHit =
      visibleHotspots.length > 0
        ? (raycaster.intersectObjects(visibleHotspots, false)[0] ?? null)
        : null;
    const sceneHit = raycaster.intersectObjects(activeTargets, false)[0] ?? null;
    if (hotspotHit && (!sceneHit || hotspotHit.distance <= sceneHit.distance + 0.35)) {
      cachedHit = hotspotHit;
    } else {
      cachedHit = sceneHit;
    }
    return cachedHit;
  };

  const pickTvButton = (nx: number, ny: number): TvButtonId | null => {
    const hit = pickClosest(nx, ny);
    if (!hit) return null;
    if (deps.hotspots.resolveTarget(hit.object) === "tv_power") return "power";
    return deps.tvButtons.resolveButtonId(hit.object);
  };

  return {
    invalidateCache: () => {
      hitCacheKey = "";
      rayCacheKey = "";
    },
    setExcludedProp: (prop) => {
      activeTargets = prop
        ? pickTargets.filter((obj) => deps.propProxies.resolvePropId(obj) !== prop)
        : pickTargets;
      hitCacheKey = "";
    },
    pickScreenUv: (nx, ny) => {
      const hit = pickClosest(nx, ny);
      if (!hit) return null;
      if (deps.hotspots.resolveTarget(hit.object) === "tv") return { x: 0.5, y: 0.5 };
      return hit.object === deps.crtGlassMesh && hit.uv ? { x: hit.uv.x, y: hit.uv.y } : null;
    },
    pickFocusProp: (nx, ny) => {
      const hit = pickClosest(nx, ny);
      if (!hit) return null;
      const hotspotTarget = deps.hotspots.resolveTarget(hit.object);
      if (hotspotTarget && hotspotTarget !== "tv" && hotspotTarget !== "tv_power") {
        return hotspotTarget;
      }
      return deps.propProxies.resolvePropId(hit.object);
    },
    pickNokiaButton: (nx, ny) => {
      const buttons = deps.nokia.getButtonMeshes().filter((mesh) => mesh.visible);
      if (buttons.length === 0) return null;
      syncRay(nx, ny, makeKey(nx, ny));
      const hit = raycaster.intersectObjects(buttons, false)[0];
      return hit ? deps.nokia.resolveButtonId(hit.object) : null;
    },
    pickTvButton,
    isPointerOverPowerButton: (nx, ny) => {
      if (pickTvButton(nx, ny) === "power") return true;
      const hit = pickClosest(nx, ny);
      if (!hit) return false;
      const dx = hit.point.x - MACINTOSH_SPEC.powerButtonX;
      const dy = hit.point.y - MACINTOSH_SPEC.powerButtonY;
      return hit.point.z > 0.9 && Math.hypot(dx, dy) <= 0.06;
    },
    isPointerOverDarkSurface: (nx, ny, powerProgress) => {
      const hit = pickClosest(nx, ny);
      if (hit?.object === deps.crtGlassMesh) return powerProgress < 0.5;
      return true;
    },
  };
};
