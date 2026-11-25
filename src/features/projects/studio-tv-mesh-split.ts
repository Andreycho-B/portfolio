import {
  BufferAttribute,
  BufferGeometry,
  type Matrix4,
  Uint16BufferAttribute,
  Uint32BufferAttribute,
} from "three";
import {
  ROW_MAX_X,
  ROW_MIN_X,
  ROW_STEP,
  TV_ROW_BUTTON_IDS,
  type TvRowButtonId,
} from "./studio-tv-buttons";

interface SplitRetroTvMeshes {
  readonly cabinetGeo: BufferGeometry;
  readonly buttonGeos: ReadonlyMap<TvRowButtonId, BufferGeometry>;
}

const extractSubGeometry = (src: BufferGeometry, triIndices: readonly number[]): BufferGeometry => {
  const posAttr = src.getAttribute("position");
  const vertTotal = posAttr ? posAttr.count : 0;
  const remap = new Int32Array(vertTotal).fill(-1);
  const keptVerts: number[] = [];
  const nextIndices: number[] = [];
  for (let i = 0; i < triIndices.length; i += 1) {
    const oldIdx = triIndices[i] ?? 0;
    let mapped = remap[oldIdx] ?? -1;
    if (mapped < 0) {
      mapped = keptVerts.length;
      remap[oldIdx] = mapped;
      keptVerts.push(oldIdx);
    }
    nextIndices.push(mapped);
  }
  const sub = new BufferGeometry();
  const keptCount = keptVerts.length;
  for (const [attrName, rawAttr] of Object.entries(src.attributes)) {
    if (!(rawAttr instanceof BufferAttribute)) continue;
    const stride = rawAttr.itemSize;
    const outArr = new Float32Array(keptCount * stride);
    for (let v = 0; v < keptCount; v += 1) {
      const srcOffset = (keptVerts[v] ?? 0) * stride;
      const dstOffset = v * stride;
      for (let k = 0; k < stride; k += 1) {
        outArr[dstOffset + k] = rawAttr.array[srcOffset + k] ?? 0;
      }
    }
    sub.setAttribute(attrName, new BufferAttribute(outArr, stride, rawAttr.normalized));
  }
  sub.setIndex(
    keptCount <= 65535
      ? new Uint16BufferAttribute(nextIndices, 1)
      : new Uint32BufferAttribute(nextIndices, 1),
  );
  return sub;
};

export const splitRetroTvButtons = (
  sourceGeo: BufferGeometry,
  worldMatrix: Matrix4,
): SplitRetroTvMeshes => {
  const transformed = sourceGeo.clone();
  transformed.applyMatrix4(worldMatrix);
  const posAttr = transformed.getAttribute("position");
  const uvAttr = transformed.getAttribute("uv");
  const indexAttr = transformed.getIndex();
  const cabinetIndices: number[] = [];
  const btnBuckets = new Map<TvRowButtonId, number[]>();
  for (const id of TV_ROW_BUTTON_IDS) btnBuckets.set(id, []);

  if (posAttr && uvAttr && indexAttr) {
    const idx = indexAttr.array;
    for (let i = 0; i < idx.length; i += 3) {
      const [i0, i1, i2] = [idx[i] ?? 0, idx[i + 1] ?? 0, idx[i + 2] ?? 0];
      const [x0, x1, x2] = [posAttr.getX(i0), posAttr.getX(i1), posAttr.getX(i2)];
      const [y0, y1, y2] = [posAttr.getY(i0), posAttr.getY(i1), posAttr.getY(i2)];
      const [z0, z1, z2] = [posAttr.getZ(i0), posAttr.getZ(i1), posAttr.getZ(i2)];
      const minX = Math.min(x0, x1, x2);
      const maxX = Math.max(x0, x1, x2);
      const minY = Math.min(y0, y1, y2);
      const maxY = Math.max(y0, y1, y2);
      const minZ = Math.min(z0, z1, z2);
      const cz = (z0 + z1 + z2) / 3;
      const cu = (uvAttr.getX(i0) + uvAttr.getX(i1) + uvAttr.getX(i2)) / 3;
      const cv = (uvAttr.getY(i0) + uvAttr.getY(i1) + uvAttr.getY(i2)) / 3;
      if (cu > 0.008 && cu < 0.232 && cv > 0.485 && cv < 0.755 && cz > 0.86) continue;
      if (
        minZ >= 1.176 &&
        minY >= -0.848 &&
        maxY <= -0.76 &&
        maxX - minX < 0.072 &&
        minX >= ROW_MIN_X &&
        maxX <= ROW_MAX_X
      ) {
        const slot = Math.min(
          13,
          Math.max(0, Math.floor(((minX + maxX) * 0.5 - ROW_MIN_X) / ROW_STEP)),
        );
        const slotMinX = ROW_MIN_X + slot * ROW_STEP;
        const slotMaxX = slotMinX + ROW_STEP;
        const id = TV_ROW_BUTTON_IDS[slot];
        if (id && minX >= slotMinX && maxX <= slotMaxX) {
          btnBuckets.get(id)?.push(i0, i1, i2);
          continue;
        }
      }
      cabinetIndices.push(i0, i1, i2);
    }
  }

  const cabinetGeo = extractSubGeometry(transformed, cabinetIndices);
  const buttonGeos = new Map<TvRowButtonId, BufferGeometry>();
  for (const [id, list] of btnBuckets) buttonGeos.set(id, extractSubGeometry(transformed, list));
  transformed.dispose();
  return { cabinetGeo, buttonGeos };
};
