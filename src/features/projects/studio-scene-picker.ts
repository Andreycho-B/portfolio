import {
  type Camera,
  type Intersection,
  type Mesh,
  type Object3D,
  Raycaster,
  Vector2,
} from "three";
import type { StudioPointerNormalized } from "./studio.types";
import type { StudioHotspotsHandle } from "./studio-hotspots";
import type { NokiaButtonId, StudioNokiaPhoneHandle } from "./studio-nokia-screen";
import type { StudioFocusPropId, StudioPropHitProxies } from "./studio-prop-focus";
import type { StudioTvButtonsHandle, TvButtonId } from "./studio-tv-buttons";

const POWER_BUTTON_X = 0.405;
const POWER_BUTTON_Y = -0.83;

interface StudioScenePickerDeps {
  readonly camera: Camera;
  readonly crtGlassMesh: Mesh;
  readonly tvButtons: StudioTvButtonsHandle;
  readonly lightSurfaceMeshes: readonly Mesh[];
  readonly darkSurfaceMeshes: readonly Mesh[];
  readonly woodenTableMesh: Mesh;
  readonly propProxies: StudioPropHitProxies;
  readonly hotspots: StudioHotspotsHandle;
  readonly nokia: StudioNokiaPhoneHandle;
}

interface StudioScenePicker {
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
  const scratchHits: Intersection[] = [];
  const darkSet = new Set<Object3D>([...deps.darkSurfaceMeshes, deps.woodenTableMesh]);
  const pickTargets: Object3D[] = [
    ...deps.lightSurfaceMeshes,
    ...deps.propProxies.meshes,
    ...darkSet,
  ];
  let activeTargets: Object3D[] = pickTargets;
  let cachedHit: Intersection | null = null;
  let [hasRay, hasHit, rayNx, rayNy, hitNx, hitNy] = [false, false, -9, -9, -9, -9];
  let [camX, camY, camZ, camQx, camQy, camQz, camQw, camP0] = [0, 0, 0, 0, 0, 0, 1, 0];

  const isCamSame = (): boolean => {
    const p = deps.camera.position;
    const q = deps.camera.quaternion;
    const p0 = deps.camera.projectionMatrix.elements[0] ?? 1;
    return (
      Math.abs(p.x - camX) < 5e-4 &&
      Math.abs(p.y - camY) < 5e-4 &&
      Math.abs(p.z - camZ) < 5e-4 &&
      Math.abs(q.x - camQx) < 5e-4 &&
      Math.abs(q.y - camQy) < 5e-4 &&
      Math.abs(q.z - camQz) < 5e-4 &&
      Math.abs(q.w - camQw) < 5e-4 &&
      Math.abs(p0 - camP0) < 5e-4
    );
  };

  const syncRay = (nx: number, ny: number): boolean => {
    const sameCam = isCamSame();
    if (hasRay && sameCam && Math.abs(nx - rayNx) < 5e-5 && Math.abs(ny - rayNy) < 5e-5) {
      return true;
    }
    if (!sameCam) {
      const { position: p, quaternion: q } = deps.camera;
      [camX, camY, camZ, camQx, camQy, camQz, camQw] = [p.x, p.y, p.z, q.x, q.y, q.z, q.w];
      camP0 = deps.camera.projectionMatrix.elements[0] ?? 1;
      hasHit = false;
    }
    [hasRay, rayNx, rayNy] = [true, nx, ny];
    rayCoords.set(nx, ny);
    raycaster.setFromCamera(rayCoords, deps.camera);
    return false;
  };

  const pickClosestVisibleHotspot = (): Intersection | null => {
    if (!deps.hotspots.mesh.visible) return null;
    scratchHits.length = 0;
    raycaster.intersectObject(deps.hotspots.mesh, false, scratchHits);
    let best: Intersection | null = null;
    for (const candidate of scratchHits) {
      if (!deps.hotspots.resolveHit(candidate)) continue;
      if (!best || candidate.distance < best.distance) best = candidate;
    }
    return best;
  };

  const pickClosest = (nx: number, ny: number): Intersection | null => {
    const rayUnchanged = syncRay(nx, ny);
    if (rayUnchanged && hasHit && Math.abs(nx - hitNx) < 5e-5 && Math.abs(ny - hitNy) < 5e-5) {
      return cachedHit;
    }
    [hasHit, hitNx, hitNy] = [true, nx, ny];
    const hotspotHit = pickClosestVisibleHotspot();
    const sceneHit = raycaster.intersectObjects(activeTargets, false)[0] ?? null;
    cachedHit =
      hotspotHit && (!sceneHit || hotspotHit.distance <= sceneHit.distance + 0.35)
        ? hotspotHit
        : sceneHit;
    return cachedHit;
  };

  const pickTvButton = (nx: number, ny: number): TvButtonId | null => {
    const hit = pickClosest(nx, ny);
    if (!hit) return null;
    if (deps.hotspots.resolveHit(hit) === "tv_power") return "power";
    return deps.tvButtons.resolveButtonId(hit.object);
  };

  return {
    invalidateCache: () => {
      [hasRay, hasHit] = [false, false];
    },
    setExcludedProp: (prop) => {
      activeTargets = prop
        ? pickTargets.filter((obj) => deps.propProxies.resolvePropId(obj) !== prop)
        : pickTargets;
      hasHit = false;
    },
    pickScreenUv: (nx, ny) => {
      const hit = pickClosest(nx, ny);
      if (!hit) return null;
      if (deps.hotspots.resolveHit(hit) === "tv") return { x: 0.5, y: 0.5 };
      return hit.object === deps.crtGlassMesh && hit.uv ? { x: hit.uv.x, y: hit.uv.y } : null;
    },
    pickFocusProp: (nx, ny) => {
      const hit = pickClosest(nx, ny);
      if (!hit) return null;
      const hotspotTarget = deps.hotspots.resolveHit(hit);
      if (hotspotTarget && hotspotTarget !== "tv" && hotspotTarget !== "tv_power") {
        return hotspotTarget;
      }
      return deps.propProxies.resolvePropId(hit.object);
    },
    pickNokiaButton: (nx, ny) => {
      const buttons = deps.nokia.getButtonMeshes();
      if (buttons.length === 0) return null;
      syncRay(nx, ny);
      scratchHits.length = 0;
      for (const mesh of buttons) raycaster.intersectObject(mesh, false, scratchHits);
      let bestDist = Number.POSITIVE_INFINITY;
      let bestId: NokiaButtonId | null = null;
      for (const hit of scratchHits) {
        if (hit.distance >= bestDist) continue;
        const resolved = deps.nokia.resolveButtonId(hit.object);
        if (resolved) {
          bestDist = hit.distance;
          bestId = resolved;
        }
      }
      return bestId;
    },
    pickTvButton,
    isPointerOverPowerButton: (nx, ny) => {
      if (pickTvButton(nx, ny) === "power") return true;
      const hit = pickClosest(nx, ny);
      if (!hit) return false;
      const dx = hit.point.x - POWER_BUTTON_X;
      const dy = hit.point.y - POWER_BUTTON_Y;
      return hit.point.z > 0.9 && Math.hypot(dx, dy) <= 0.06;
    },
    isPointerOverDarkSurface: (nx, ny, powerProgress) => {
      const hit = pickClosest(nx, ny);
      if (hit?.object === deps.crtGlassMesh) return powerProgress < 0.5;
      return true;
    },
  };
};
