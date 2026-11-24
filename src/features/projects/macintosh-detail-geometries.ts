import { BufferGeometry, Float32BufferAttribute, MathUtils, Shape } from "three";
import { MACINTOSH_SPEC } from "./macintosh-profile";

export const smoothStepRange = (edge0: number, edge1: number, x: number): number => {
  const t = MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const buildIndexedGrid = (
  rows: number,
  cols: number,
  skipColumn?: (col: number) => boolean,
): number[] => {
  const stride = cols + 1;
  const indices: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (skipColumn?.(c)) continue;
      const a = r * stride + c;
      const b = a + 1;
      const cIdx = (r + 1) * stride + c;
      const d = cIdx + 1;
      indices.push(a, b, cIdx, b, d, cIdx);
    }
  }
  return indices;
};

export const finalizeColoredMeshGrid = (
  positions: number[],
  colors: number[],
  uvs: number[],
  indices: number[],
): BufferGeometry => {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

export const createRoundedSquareShape = (halfSize: number, radius: number): Shape => {
  const shape = new Shape();
  const r = Math.min(radius, halfSize);
  shape.moveTo(-halfSize + r, -halfSize);
  shape.lineTo(halfSize - r, -halfSize);
  shape.quadraticCurveTo(halfSize, -halfSize, halfSize, -halfSize + r);
  shape.lineTo(halfSize, halfSize - r);
  shape.quadraticCurveTo(halfSize, halfSize, halfSize - r, halfSize);
  shape.lineTo(-halfSize + r, halfSize);
  shape.quadraticCurveTo(-halfSize, halfSize, -halfSize, halfSize - r);
  shape.lineTo(-halfSize, -halfSize + r);
  shape.quadraticCurveTo(-halfSize, -halfSize, -halfSize + r, -halfSize);
  return shape;
};

export const createCurvedPedestalGeometry = (): BufferGeometry => {
  const segs = 56;
  const rows = 3;
  const topY = MACINTOSH_SPEC.pedestalTopY;
  const botY = MACINTOSH_SPEC.pedestalBottomY;
  const rowTs: readonly number[] = [0, 0.32, 0.64, 1];
  const rowLums: readonly (readonly [number, number, number])[] = [
    [0.24, 0.27, 0.3],
    [0.37, 0.41, 0.45],
    [0.33, 0.37, 0.41],
    [0.16, 0.19, 0.23],
  ];
  const positions: number[] = [];
  const colors: number[] = [];

  for (let r = 0; r <= rows; r++) {
    const v = rowTs[r] ?? 0;
    const baseRgb = rowLums[r] ?? [0.3, 0.34, 0.38];
    const y = MathUtils.lerp(topY, botY, v);
    const halfW = MathUtils.lerp(0.965, 0.945, v);
    const zCenter = MathUtils.lerp(0.415, 0.375, v);
    for (let i = 0; i <= segs; i++) {
      const u = (i / segs) * 2 - 1;
      const absU = Math.abs(u);
      const signU = u < 0 ? -1 : 1;
      let nx = 0;
      let depthBack = 0;
      if (absU <= 0.76) {
        nx = u / 0.76;
        depthBack = 0.058 * nx * nx;
      } else {
        const s = (absU - 0.76) / 0.24;
        const phi = s * Math.PI * 0.5;
        nx = signU * (1 - 0.18 * (1 - Math.cos(phi)));
        depthBack = 0.058 + 0.62 * (1 - Math.cos(phi));
      }
      const cornerAO =
        1 - 0.28 * nx * nx * nx * nx - (absU > 0.76 ? ((absU - 0.76) / 0.24) * 0.28 : 0);
      positions.push(nx * halfW, y, zCenter - depthBack);
      colors.push(baseRgb[0] * cornerAO, baseRgb[1] * cornerAO, baseRgb[2] * cornerAO);
    }
  }

  const stride = segs + 1;
  const indices: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < segs; c++) {
      const a = r * stride + c;
      const b = a + 1;
      const cIdx = (r + 1) * stride + c;
      const d = cIdx + 1;
      indices.push(a, cIdx, b, b, cIdx, d);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};
