import { type BufferGeometry, MathUtils } from "three";
import { finalizeColoredMeshGrid } from "./macintosh-detail-geometries";
import {
  evalChinBottomY,
  evalFrontSurfaceZ,
  evalGrooveY,
  MACINTOSH_SPEC,
} from "./macintosh-profile";

const buildGrooveColumns = (): readonly number[] => {
  const cols: number[] = [];
  const xMin = -1.44;
  const xMax = 1.44;
  const steps = 96;
  for (let i = 0; i <= steps; i++) {
    cols.push(MathUtils.lerp(xMin, xMax, i / steps));
  }
  const cuts = [
    MACINTOSH_SPEC.floppyStartX - 0.0005,
    MACINTOSH_SPEC.floppyStartX + 0.0005,
    MACINTOSH_SPEC.floppyEndX - 0.0005,
    MACINTOSH_SPEC.floppyEndX + 0.0005,
  ];
  for (const cut of cuts) cols.push(cut);
  cols.sort((a, b) => a - b);
  return cols;
};

export const createGrooveAndFloppyCavityGeometry = (): BufferGeometry => {
  const xs = buildGrooveColumns();
  const segsX = xs.length - 1;
  const profileRows: readonly (readonly [number, number, number, number, number, number])[] = [
    [
      MACINTOSH_SPEC.grooveTopDy + 0.003,
      MACINTOSH_SPEC.grooveTopDy + 0.003,
      0.0005,
      0.0005,
      0.85,
      0.85,
    ],
    [0.022, 0.022, -0.008, -0.01, 0.36, 0.08],
    [0.01, 0.012, -0.026, -0.034, 0.24, 0.003],
    [-0.004, -0.004, -0.026, -0.036, 0.52, 0.002],
    [-0.034, -0.04, -0.025, -0.036, 0.61, 0.002],
    [-0.043, -0.047, -0.022, -0.032, 0.56, 0.004],
    [-0.049, -0.051, -0.001, -0.001, 1.1, 1.12],
    [
      MACINTOSH_SPEC.grooveBotDy - 0.002,
      MACINTOSH_SPEC.grooveBotDy - 0.002,
      0.0005,
      0.0005,
      0.855,
      0.855,
    ],
  ];
  const rows = profileRows.length - 1;
  const stride = segsX + 1;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r <= rows; r++) {
    const row = profileRows[r];
    if (!row) continue;
    const [dyGroove, dySlot, dzGroove, dzSlot, grooveLum, slotLum] = row;
    for (let c = 0; c <= segsX; c++) {
      const rawX = xs[c] ?? 0;
      const absRaw = Math.abs(rawX);
      const signX = rawX < 0 ? -1 : 1;
      const shoulderStart = 1.385 - 0.034;
      const edgeT = MathUtils.clamp((absRaw - shoulderStart) / (1.44 - shoulderStart), 0, 1);
      const phi = edgeT * Math.PI * 0.5;
      const x = absRaw > shoulderStart ? signX * (shoulderStart + 0.034 * Math.sin(phi)) : rawX;
      const edgeWrapZ = -MACINTOSH_SPEC.filletDepth * (1 - Math.cos(phi));
      const inSlot = x >= MACINTOSH_SPEC.floppyStartX && x <= MACINTOSH_SPEC.floppyEndX;
      const dy = inSlot ? dySlot : dyGroove;
      const dz = inSlot ? dzSlot : dzGroove;
      const y = evalGrooveY(x) + dy;
      const z = evalFrontSurfaceZ(x, y) + dz * (1 - edgeT * 0.45) + edgeWrapZ;
      const slotWallDist = Math.min(
        Math.abs(x - MACINTOSH_SPEC.floppyStartX),
        Math.abs(x - MACINTOSH_SPEC.floppyEndX),
      );
      const slotStepAO = !inSlot && r >= 2 && r <= 5 ? Math.exp(-slotWallDist / 0.028) * 0.22 : 0;
      const sideEdgeAO = r >= 1 && r <= 5 ? edgeT * 0.22 : edgeT * 0.14;
      const lum = Math.max(0.002, (inSlot ? slotLum : grooveLum) * (1 - slotStepAO - sideEdgeAO));

      positions.push(x, y, z);
      colors.push(lum, lum, lum * (inSlot ? 1.0 : 0.996));
      uvs.push(c / segsX, r / rows);
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < segsX; c++) {
      const a = r * stride + c;
      const b = a + 1;
      const cIdx = (r + 1) * stride + c;
      const d = cIdx + 1;
      indices.push(a, cIdx, b, b, cIdx, d);
    }
  }

  return finalizeColoredMeshGrid(positions, colors, uvs, indices);
};

const evaluateChinHalfWidth = (vFront: number): number =>
  1.385 - 0.042 * vFront - 0.024 * vFront * vFront;

export const createLowerChinGeometry = (): BufferGeometry => {
  const segsU = 112;
  const segsV = 32;
  const stride = segsU + 1;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r <= segsV; r++) {
    const v = r / segsV;
    const isUnder = v > 0.74;
    const vUnder = isUnder ? (v - 0.74) / 0.26 : 0;
    const underPhi = vUnder * Math.PI * 0.5;
    const vFront = isUnder ? 1.0 : v / 0.74;
    const baseHalfW =
      evaluateChinHalfWidth(vFront) * MathUtils.lerp(1.0, 0.88, 1 - Math.cos(underPhi));

    for (let c = 0; c <= segsU; c++) {
      const u = c / segsU;
      let sideDepth = 0;
      let normX = 0;
      let shoulderOut = 0;
      let rearScale = 1;
      if (u < 0.16 || u > 0.84) {
        const isLeft = u < 0.16;
        const s = isLeft ? 1 - u / 0.16 : (u - 0.84) / 0.16;
        const sideSign = isLeft ? -1 : 1;
        normX = sideSign;
        if (s <= 0.45) {
          const phi = (s / 0.45) * Math.PI * 0.5;
          shoulderOut = sideSign * 0.034 * Math.sin(phi);
          sideDepth = MACINTOSH_SPEC.filletDepth * (1 - Math.cos(phi));
        } else {
          const k = (s - 0.45) / 0.55;
          shoulderOut = sideSign * 0.034;
          rearScale = MathUtils.lerp(1.0, 0.86, k);
          sideDepth = MACINTOSH_SPEC.filletDepth + k * 1.35;
        }
      } else {
        normX = ((u - 0.16) / 0.68) * 2 - 1;
      }

      const absNX = Math.abs(normX);
      const signNX = normX < 0 ? -1 : 1;
      const cornerT = MathUtils.clamp((absNX - 0.74) / 0.26, 0, 1);
      const cornerPhi = cornerT * Math.PI * 0.5;
      const arcNX = cornerT > 0 ? signNX * (0.74 + 0.26 * Math.sin(cornerPhi)) : normX;
      const effNX = MathUtils.lerp(normX, arcNX, vFront ** 1.35);
      const cornerLiftY = 0.175 * (1 - Math.cos(cornerPhi)) * vFront ** 1.5;

      const frontHalfW = Math.max(0.1, baseHalfW - 0.034);
      const x = (effNX * frontHalfW + shoulderOut) * rearScale;
      const yTop = evalGrooveY(x) + MACINTOSH_SPEC.grooveBotDy;
      const yBot = evalChinBottomY(x) + cornerLiftY;
      const yFront = MathUtils.lerp(yTop, yBot, vFront);
      const y = isUnder
        ? MathUtils.lerp(yBot, MACINTOSH_SPEC.pedestalTopY + 0.01, 1 - Math.cos(underPhi))
        : yFront;

      const baseZ = evalFrontSurfaceZ(x, yFront);
      const underZ = baseZ - 0.34 * (1 - Math.cos(underPhi)) - 0.95 * vUnder * vUnder;
      const z = underZ - sideDepth;

      const bottomRoll = vFront > 0.78 ? ((vFront - 0.78) / 0.22) ** 1.8 : 0;
      const frontShade = MathUtils.lerp(0.865, 0.85, vFront) - bottomRoll * 0.12;
      const underShade = MathUtils.lerp(frontShade, 0.26, Math.sin(underPhi));
      const flankShade =
        sideDepth > 0 ? MathUtils.lerp(1.0, 0.64, Math.min(1, sideDepth / 0.52)) : 1;
      const lum = MathUtils.clamp(underShade * flankShade, 0.24, 1.0);

      positions.push(x, y, z);
      colors.push(lum * 0.985, lum, lum * 1.004);
      uvs.push(u * 2.5, v);
    }
  }

  for (let r = 0; r < segsV; r++) {
    for (let c = 0; c < segsU; c++) {
      const a = r * stride + c;
      const b = a + 1;
      const cIdx = (r + 1) * stride + c;
      const d = cIdx + 1;
      indices.push(a, cIdx, b, b, cIdx, d);
    }
  }

  return finalizeColoredMeshGrid(positions, colors, uvs, indices);
};
