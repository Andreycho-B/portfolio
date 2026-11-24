import { type BufferGeometry, MathUtils } from "three";
import {
  buildIndexedGrid,
  finalizeColoredMeshGrid,
  smoothStepRange,
} from "./macintosh-detail-geometries";
import {
  BEZEL_RIDGE_SPEC,
  type ContourSample,
  evalFrontSurfaceZ,
  MACINTOSH_SPEC,
  SCREEN_INNER_SPEC,
  sampleRoundedTrapezoid,
  UPPER_OUTER_SPEC,
} from "./macintosh-profile";

const SHOULDER_INSET = 0.034;

const getEffectiveInset = (sample: ContourSample): number =>
  SHOULDER_INSET * (1 - smoothStepRange(0.35, 0.85, -sample.ny));

export const createOuterBodyGeometry = (): BufferGeometry => {
  const outer = sampleRoundedTrapezoid(UPPER_OUTER_SPEC);
  const cols = outer.length - 1;
  const depthRings = 22;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];

  for (let r = 0; r <= depthRings; r++) {
    const v = r / depthRings;
    for (let c = 0; c <= cols; c++) {
      const sample = outer[c];
      if (!sample) continue;
      const effInset = getEffectiveInset(sample);
      const shX = sample.x - sample.nx * effInset;
      const shY = sample.y - sample.ny * effInset;
      const frontZ = evalFrontSurfaceZ(shX, shY);
      const filletStartZ = frontZ - MACINTOSH_SPEC.filletDepth;

      let px = sample.x;
      let py = sample.y;
      let pz = frontZ;
      let shade = 1.0;

      if (v <= 0.45) {
        const k = v / 0.45;
        const rearScale = MathUtils.lerp(0.86, 1.0, k * (2 - k));
        px = sample.x * rearScale;
        py = 0.3 + (sample.y - 0.3) * rearScale;
        pz = MathUtils.lerp(MACINTOSH_SPEC.rearZ, filletStartZ, k);
        shade = MathUtils.lerp(0.54, 0.74, k);
      } else {
        const f = (v - 0.45) / 0.55;
        const phi = f * Math.PI * 0.5;
        const inset = effInset * (1 - Math.cos(phi));
        px = sample.x - sample.nx * inset;
        py = sample.y - sample.ny * inset;
        pz = filletStartZ + MACINTOSH_SPEC.filletDepth * Math.sin(phi);
        const yGrad = MathUtils.clamp((py + 0.58) / 1.76, 0, 1);
        const frontTarget = 0.855 + yGrad * 0.165;
        const shoulderCrease = Math.abs(sample.nx) * Math.sin(f * Math.PI) ** 2 * 0.032;
        shade = MathUtils.lerp(0.72, frontTarget, Math.sin(phi) ** 0.85) - shoulderCrease;
      }

      positions.push(px, py, pz);
      uvs.push((c / cols) * 4, v * 2);

      const topWall = smoothStepRange(0.35, 0.85, sample.ny);
      const lum = MathUtils.clamp(shade + topWall * 0.12, 0.5, 1.12);
      colors.push(lum, lum, lum * 0.996);
    }
  }

  return finalizeColoredMeshGrid(
    positions,
    colors,
    uvs,
    buildIndexedGrid(depthRings, cols, (col) => {
      const s0 = outer[col];
      const s1 = outer[col + 1];
      return Boolean(s0 && s1 && s0.ny < -0.55 && s1.ny < -0.55);
    }),
  );
};

const evaluateBezelVertex = (
  t: number,
  outer: ContourSample,
  ridge: ContourSample,
  inner: ContourSample,
): {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rgb: readonly [number, number, number];
} => {
  const effInset = getEffectiveInset(outer);
  const shX = outer.x - outer.nx * effInset;
  const shY = outer.y - outer.ny * effInset;
  const topWall = smoothStepRange(0.45, 0.82, inner.ny);
  const botWall = smoothStepRange(0.45, 0.82, -inner.ny);
  const sideWall = smoothStepRange(0.45, 0.82, Math.abs(inner.nx));
  const topCorner =
    smoothStepRange(0.18, 0.76, inner.ny) * smoothStepRange(0.18, 0.76, Math.abs(inner.nx));
  const botCorner =
    smoothStepRange(0.18, 0.76, -inner.ny) * smoothStepRange(0.18, 0.76, Math.abs(inner.nx));

  if (t <= 0.32) {
    const k = t / 0.32;
    const x = MathUtils.lerp(shX, ridge.x, k);
    const y = MathUtils.lerp(shY, ridge.y, k);
    const z = evalFrontSurfaceZ(x, y);
    const yGrad = MathUtils.clamp((y + 0.58) / 1.76, 0, 1);
    const preRidgeDip =
      sideWall * Math.sin(MathUtils.clamp((k - 0.65) / 0.35, 0, 1) * Math.PI) * 0.018;
    const frontTone =
      0.855 +
      yGrad * 0.165 +
      topWall * 0.095 -
      botWall * 0.015 -
      sideWall * (1 - k) * 0.025 -
      preRidgeDip;
    const lum = MathUtils.clamp(frontTone, 0.82, 1.12);
    return { x, y, z, rgb: [lum, lum, lum * 0.996] };
  }

  if (t <= 0.4) {
    const k = (t - 0.32) / 0.08;
    const s = k * k * (3 - 2 * k);
    const x = MathUtils.lerp(ridge.x, inner.x, s * 0.08);
    const y = MathUtils.lerp(ridge.y, inner.y, s * 0.08);
    const z = evalFrontSurfaceZ(x, y) - s * 0.015;
    const yGrad = MathUtils.clamp((y + 0.58) / 1.76, 0, 1);
    const cornerOcclusion = 1 - topCorner * (0.14 + 0.24 * s) - botCorner * (0.08 * s);
    const ridgeTone =
      (0.88 + yGrad * 0.14 + botWall * 0.18 - topWall * (0.28 * s) + sideWall * 0.085) *
      cornerOcclusion;
    const lum = MathUtils.clamp(ridgeTone, 0.42, 1.14);
    return { x, y, z, rgb: [lum, lum, lum * 0.996] };
  }

  if (t <= 0.88) {
    const k = (t - 0.4) / 0.48;
    const easeK = 0.08 + 0.92 * k;
    const x = MathUtils.lerp(ridge.x, inner.x, easeK);
    const y = MathUtils.lerp(ridge.y, inner.y, easeK);
    const baseZ = evalFrontSurfaceZ(x, y);
    const depth = 0.015 + (MACINTOSH_SPEC.bezelRecessDepth - 0.015) * k;
    const yGrad = MathUtils.clamp((y + 0.35) / 1.35, 0, 1);

    const topShade = MathUtils.lerp(0.56, 0.4, k);
    const sideShade = MathUtils.lerp(1.04, 0.94, k) * (0.94 + yGrad * 0.08);
    const botShade = MathUtils.lerp(1.14, 1.05, k);
    const totalW = topWall + botWall + sideWall + 0.0001;
    const baseLum = (topWall * topShade + botWall * botShade + sideWall * sideShade) / totalW;
    const pocketCrease = k > 0.72 ? ((k - 0.72) / 0.28) ** 1.6 * (0.12 + 0.14 * topWall) : 0;
    const cornerAO = 1 - topCorner * (0.38 + 0.12 * k) - botCorner * (0.15 + 0.12 * k);
    const lum = MathUtils.clamp((baseLum - pocketCrease) * cornerAO, 0.22, 1.14);
    return { x, y, z: baseZ - depth, rgb: [lum * 0.99, lum * 0.996, lum] };
  }

  const k = (t - 0.88) / 0.12;
  const shrink = MathUtils.lerp(1.0, 0.988, k);
  const x = inner.x * shrink;
  const y = MACINTOSH_SPEC.screenCenterY + (inner.y - MACINTOSH_SPEC.screenCenterY) * shrink;
  const z =
    evalFrontSurfaceZ(inner.x, inner.y) -
    MACINTOSH_SPEC.bezelRecessDepth -
    MACINTOSH_SPEC.gasketRecessDepth * k;
  const dark = MathUtils.lerp(0.09, 0.02, k) * (1 - topCorner * 0.45 - botCorner * 0.3);
  return { x, y, z, rgb: [dark, dark * 1.04, dark * 1.1] };
};

export const createUpperBezelGeometry = (): BufferGeometry => {
  const outer = sampleRoundedTrapezoid(UPPER_OUTER_SPEC);
  const ridge = sampleRoundedTrapezoid(BEZEL_RIDGE_SPEC);
  const inner = sampleRoundedTrapezoid(SCREEN_INNER_SPEC);
  const cols = outer.length - 1;
  const radialRings = 36;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];

  for (let r = 0; r <= radialRings; r++) {
    const v = r / radialRings;
    for (let c = 0; c <= cols; c++) {
      const oPt = outer[c];
      const rPt = ridge[c];
      const iPt = inner[c];
      if (!oPt || !rPt || !iPt) continue;
      const sample = evaluateBezelVertex(v, oPt, rPt, iPt);
      positions.push(sample.x, sample.y, sample.z);
      colors.push(sample.rgb[0], sample.rgb[1], sample.rgb[2]);
      uvs.push(sample.x * 0.35 + 0.5, sample.y * 0.35 + 0.5);
    }
  }

  return finalizeColoredMeshGrid(positions, colors, uvs, buildIndexedGrid(radialRings, cols));
};
