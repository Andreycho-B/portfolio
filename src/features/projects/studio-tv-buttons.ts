import {
  BoxGeometry,
  type BufferGeometry,
  Group,
  type Material,
  type Matrix4,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  Uint32BufferAttribute,
} from "three";
import type { TvChannelMode } from "./studio-tv-channels";

type TvDigitBtn = "ch1" | "ch2" | "ch3" | "ch4" | "ch5" | "ch6" | "ch7" | "ch8" | "ch9" | "ch0";
type TvControlBtn = "ch_prev" | "ch_next" | "mute" | "power" | "dvd";
export type TvButtonId = TvDigitBtn | TvControlBtn;

export interface StudioSceneTvApi {
  readonly pickTvButton: (nx: number, ny: number) => TvButtonId | null;
  readonly pressTvButtonVisual: (id: TvButtonId) => void;
  readonly setHoveredTvButton: (id: TvButtonId | null) => void;
  readonly setTvChannel: (mode: TvChannelMode) => void;
  readonly getTvChannel: () => TvChannelMode;
}

export type TvButtonSpec = { readonly id: TvButtonId; readonly x: number; readonly y: number };

const ROW_A: readonly TvButtonId[] = ["ch1", "ch2", "ch3", "ch4", "ch5", "ch6", "ch7"];
const ROW_B: readonly TvButtonId[] = ["ch8", "ch9", "ch0", "ch_prev", "ch_next", "mute", "power"];
const TV_ROW_BUTTON_IDS: readonly TvButtonId[] = [...ROW_A, ...ROW_B];
const [ROW_MIN_X, ROW_MAX_X, ROW_Y, ROW_Z] = [-0.524, 0.524, -0.805, 1.21];
const ROW_STEP = (ROW_MAX_X - ROW_MIN_X) / TV_ROW_BUTTON_IDS.length;

export const TV_BUTTON_SPECS: readonly TvButtonSpec[] = [
  ...TV_ROW_BUTTON_IDS.map((id, i) => ({ id, x: ROW_MIN_X + (i + 0.5) * ROW_STEP, y: ROW_Y })),
  { id: "dvd", x: -0.62, y: -0.95 },
];

export interface SplitRetroTvResult {
  readonly cabinetGeo: BufferGeometry;
  readonly buttonGeos: ReadonlyMap<TvButtonId, BufferGeometry>;
}

export const splitRetroTvButtons = (
  sourceGeo: BufferGeometry,
  worldMatrix: Matrix4,
): SplitRetroTvResult => {
  const transformed = sourceGeo.clone();
  transformed.applyMatrix4(worldMatrix);
  const posAttr = transformed.getAttribute("position");
  const uvAttr = transformed.getAttribute("uv");
  const indexAttr = transformed.getIndex();
  const cabinetIndices: number[] = [];
  const btnBuckets = new Map<TvButtonId, number[]>();
  for (const id of TV_ROW_BUTTON_IDS) btnBuckets.set(id, []);

  if (posAttr && uvAttr && indexAttr) {
    const idx = indexAttr.array;
    for (let i = 0; i < idx.length; i += 3) {
      const [i0, i1, i2] = [idx[i] ?? 0, idx[i + 1] ?? 0, idx[i + 2] ?? 0];
      const cx = (posAttr.getX(i0) + posAttr.getX(i1) + posAttr.getX(i2)) / 3;
      const cy = (posAttr.getY(i0) + posAttr.getY(i1) + posAttr.getY(i2)) / 3;
      const cz = (posAttr.getZ(i0) + posAttr.getZ(i1) + posAttr.getZ(i2)) / 3;
      const cu = (uvAttr.getX(i0) + uvAttr.getX(i1) + uvAttr.getX(i2)) / 3;
      const cv = (uvAttr.getY(i0) + uvAttr.getY(i1) + uvAttr.getY(i2)) / 3;

      if (cu > 0.008 && cu < 0.232 && cv > 0.485 && cv < 0.755 && cz > 0.86) continue;
      if (cy >= -0.855 && cy <= -0.755 && cz >= 1.17 && cx >= ROW_MIN_X && cx <= ROW_MAX_X) {
        const slot = Math.min(13, Math.max(0, Math.floor((cx - ROW_MIN_X) / ROW_STEP)));
        const id = TV_ROW_BUTTON_IDS[slot];
        if (id) {
          btnBuckets.get(id)?.push(i0, i1, i2);
          continue;
        }
      }
      cabinetIndices.push(i0, i1, i2);
    }
  }

  const cabinetGeo = transformed.clone();
  cabinetGeo.setIndex(new Uint32BufferAttribute(cabinetIndices, 1));
  const buttonGeos = new Map<TvButtonId, BufferGeometry>();
  for (const [id, list] of btnBuckets) {
    const geo = transformed.clone();
    geo.setIndex(new Uint32BufferAttribute(list, 1));
    buttonGeos.set(id, geo);
  }
  transformed.dispose();
  return { cabinetGeo, buttonGeos };
};

export interface StudioTvButtonsHandle {
  readonly hitMeshes: readonly Mesh[];
  readonly powerHitMesh: Mesh;
  readonly resolveButtonId: (object: Object3D) => TvButtonId | null;
  readonly bindVisuals: (geos: ReadonlyMap<TvButtonId, BufferGeometry>, mat: Material) => void;
  readonly triggerPress: (id: TvButtonId) => void;
  readonly setPowerDepth: (ratio: number) => void;
  readonly getPressDepth: (id: TvButtonId) => number;
  readonly update: (dtSeconds: number) => boolean;
  readonly dispose: () => void;
}

export const createStudioTvButtons = (parent: Group): StudioTvButtonsHandle => {
  const root = new Group();
  root.name = "tvFrontButtons";
  parent.add(root);

  const proxyMat = new MeshBasicMaterial();
  const rowHitGeo = new BoxGeometry(ROW_STEP * 0.98, 0.115, 0.14);
  const dvdHitGeo = new BoxGeometry(0.58, 0.125, 0.14);
  const hitMeshes: Mesh[] = [];
  const lookup = new Map<Object3D, TvButtonId>();
  const visualMeshes = new Map<TvButtonId, Mesh>();
  const visualGeos: BufferGeometry[] = [];
  const press = new Map<TvButtonId, number>();
  let powerBaseDepth = 0;

  const addHit = (id: TvButtonId, geo: BoxGeometry, x: number, y: number): Mesh => {
    const mesh = new Mesh(geo, proxyMat);
    mesh.name = `tvBtnHit_${id}`;
    mesh.position.set(x, y, ROW_Z);
    mesh.visible = false;
    mesh.updateMatrix();
    mesh.updateMatrixWorld(true);
    mesh.matrixAutoUpdate = false;
    root.add(mesh);
    hitMeshes.push(mesh);
    lookup.set(mesh, id);
    return mesh;
  };
  let powerHitMesh: Mesh | null = null;
  for (const spec of TV_BUTTON_SPECS) {
    const mesh = addHit(spec.id, spec.id === "dvd" ? dvdHitGeo : rowHitGeo, spec.x, spec.y);
    if (spec.id === "power") powerHitMesh = mesh;
  }

  const bindVisuals = (geos: ReadonlyMap<TvButtonId, BufferGeometry>, mat: Material): void => {
    for (const [id, geo] of geos) {
      const mesh = new Mesh(geo, mat);
      mesh.name = `tvBtnVis_${id}`;
      mesh.castShadow = mesh.receiveShadow = true;
      if (id === "power") mesh.position.z = -powerBaseDepth * 0.016;
      root.add(mesh);
      visualMeshes.set(id, mesh);
      visualGeos.push(geo);
    }
  };

  const triggerPress = (id: TvButtonId): void => {
    if (id === "dvd") return;
    press.set(id, 1);
    const mesh = visualMeshes.get(id);
    if (mesh) mesh.position.z = -0.018;
  };

  const setPowerDepth = (ratio: number): void => {
    powerBaseDepth = ratio;
    const mesh = visualMeshes.get("power");
    if (mesh) mesh.position.z = -Math.max(ratio, press.get("power") ?? 0) * 0.016;
  };

  const update = (dtSeconds: number): boolean => {
    if (press.size === 0) return false;
    const decay = Math.exp(-15 * Math.min(Math.max(dtSeconds, 0), 0.05));
    for (const [id, val] of press) {
      const next = val * decay;
      const mesh = visualMeshes.get(id);
      if (next < 0.01) {
        press.delete(id);
        if (mesh) mesh.position.z = id === "power" ? -powerBaseDepth * 0.016 : 0;
      } else {
        press.set(id, next);
        const depth = id === "power" ? Math.max(powerBaseDepth, next) * 0.016 : next * 0.018;
        if (mesh) mesh.position.z = -depth;
      }
    }
    return press.size > 0;
  };

  return {
    hitMeshes,
    powerHitMesh: powerHitMesh ?? (hitMeshes[0] as Mesh),
    resolveButtonId: (obj) => lookup.get(obj) ?? null,
    bindVisuals,
    triggerPress,
    setPowerDepth,
    getPressDepth: (id) =>
      id === "power"
        ? Math.max(powerBaseDepth, press.get(id) ?? 0) * 0.016
        : (press.get(id) ?? 0) * 0.018,
    update,
    dispose: () => {
      parent.remove(root);
      for (const g of [rowHitGeo, dvdHitGeo, ...visualGeos]) g.dispose();
      proxyMat.dispose();
    },
  };
};
