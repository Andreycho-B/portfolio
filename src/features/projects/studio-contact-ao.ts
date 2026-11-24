import { ClampToEdgeWrapping, DataTexture, LinearFilter, RGBAFormat, SRGBColorSpace } from "three";

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

const smooth = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const sdBox2 = (px: number, py: number, bx: number, by: number, r: number): number => {
  const qx = Math.abs(px) - bx + r;
  const qy = Math.abs(py) - by + r;
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
};

const aoStep = (d: number, s: number): number =>
  1 / (1 + Math.exp(2 * Math.max(-8, Math.min(8, d / s))));

const propAo = (dBase: number, dTail: number, core: number, spread: number): number => {
  const c = aoStep(dBase, 0.065) * core;
  return Math.min(0.72, Math.max(0, c + aoStep(dTail, spread) * 0.22 * (1 - c)));
};

const makeAoTexture = (data: Uint8Array, width: number, height: number): DataTexture => {
  const tex = new DataTexture(data, width, height, RGBAFormat);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
  tex.minFilter = tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
};

export const bakeTableContactAo = (): DataTexture => {
  const [w, h] = [192, 120];
  const data = new Uint8Array(w * h * 4);
  const [sx, sy] = [0.08, -0.14];
  for (let y = 0; y < h; y++) {
    const py = -(((y + 0.5) / h - 0.5) * 3.74);
    for (let x = 0; x < w; x++) {
      const px = ((x + 0.5) / w - 0.5) * 6.04;
      const tv = propAo(
        sdBox2(px - 0.03, py + 0.02, 1.02, 0.96, 0.15),
        sdBox2(px - 0.03 - sx * 1.4, py + 0.02 - sy * 1.4, 1.06, 0.98, 0.18),
        0.56,
        0.28,
      );
      const pc = propAo(
        sdBox2(px + 2.22, py + 0.32, 0.46, 0.42, 0.1),
        sdBox2(px + 2.22 - sx, py + 0.32 - sy, 0.48, 0.44, 0.12),
        0.48,
        0.2,
      );
      const clk = propAo(
        sdBox2(px + 1.84, py - 0.46, 0.32, 0.14, 0.07),
        sdBox2(px + 1.84 - sx * 0.8, py - 0.46 - sy * 0.8, 0.35, 0.16, 0.08),
        0.42,
        0.16,
      );
      const bust = propAo(
        Math.hypot(px - 2.18, py + 0.28) - 0.34,
        Math.hypot(px - 2.18 - sx * 0.9, py + 0.28 - sy * 0.9) - 0.36,
        0.46,
        0.18,
      );
      const thm = propAo(
        Math.hypot(px - 2.28, py - 1.05) - 0.19,
        Math.hypot(px - 2.28 - sx * 0.75, py - 1.05 - sy * 0.75) - 0.21,
        0.46,
        0.15,
      );
      const [nkDx, nkDy] = [px - 1.42, py - 1.36];
      const [nkLx, nkLy] = [nkDx * 0.943 + nkDy * 0.334, -nkDx * 0.334 + nkDy * 0.943];
      const nk = propAo(
        sdBox2(nkLx, nkLy, 0.145, 0.34, 0.05),
        sdBox2(nkLx - 0.03, nkLy + 0.05, 0.16, 0.36, 0.06),
        0.44,
        0.09,
      );
      const edge = smooth(3.02, 2.78, Math.abs(px)) * smooth(1.86, 1.66, Math.abs(py));
      const a = Math.min(
        0.68,
        (1 - (1 - tv) * (1 - pc) * (1 - clk) * (1 - bust) * (1 - thm) * (1 - nk)) * edge,
      );
      const idx = (y * w + x) * 4;
      data[idx] = 8;
      data[idx + 1] = 7;
      data[idx + 2] = 8;
      data[idx + 3] = Math.round(a * 255);
    }
  }
  return makeAoTexture(data, w, h);
};

export const bakeFloorAo = (): DataTexture => {
  const s = 128;
  const data = new Uint8Array(s * s * 4);
  for (let y = 0; y < s; y++) {
    const ly = ((y + 0.5) / s - 0.5) * 9.8;
    for (let x = 0; x < s; x++) {
      const lx = ((x + 0.5) / s - 0.5) * 10.6;
      const [px, py] = [lx - 0.25, -ly + 0.75];
      const dT = Math.hypot((px - 0.35) / 3.65, (py + 0.5) / 2.35);
      const dC = Math.hypot((px + 1.6) / 1.55, (py - 3.35) / 1.45);
      const glow = Math.exp(-dT * dT * 1.5) * 0.11 + Math.exp(-dC * dC * 1.7) * 0.09;
      const a = Math.min(0.14, glow * smooth(5.2, 3.0, Math.hypot(lx, ly)));
      const idx = (y * s + x) * 4;
      data[idx] = 20;
      data[idx + 1] = 28;
      data[idx + 2] = 43;
      data[idx + 3] = Math.round(a * 255);
    }
  }
  return makeAoTexture(data, s, s);
};
