import {
  BufferGeometry,
  type Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Object3D,
  type Texture,
} from "three";

const isResizableImage = (
  img: unknown,
): img is HTMLImageElement | ImageBitmap | HTMLCanvasElement =>
  (typeof HTMLImageElement !== "undefined" && img instanceof HTMLImageElement) ||
  (typeof HTMLCanvasElement !== "undefined" && img instanceof HTMLCanvasElement) ||
  (typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap);

const disposeMaterialTextures = (mat: Material): void => {
  if (!(mat instanceof MeshStandardMaterial)) return;
  const maps = [
    mat.map,
    mat.roughnessMap,
    mat.metalnessMap,
    mat.normalMap,
    mat.emissiveMap,
    mat.alphaMap,
    mat.aoMap,
  ];
  for (const tex of maps) tex?.dispose();
};

export const disposeObject3DResources = (root: Object3D): void => {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    if (node.geometry instanceof BufferGeometry) geometries.add(node.geometry);
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    for (const m of mats) if (m) materials.add(m);
  });
  for (const geo of geometries) geo.dispose();
  for (const mat of materials) {
    disposeMaterialTextures(mat);
    mat.dispose();
  }
};

export const clampPbrTextureBudget = (tex: Texture | null | undefined, maxDim: number): void => {
  if (!tex || typeof document === "undefined") return;
  const src = tex.image as unknown;
  if (!isResizableImage(src)) return;
  const w = src.width;
  const h = src.height;
  if (w <= maxDim && h <= maxDim) return;

  const scale = maxDim / Math.max(w, h);
  const targetW = Math.max(1, Math.round(w * scale));
  const targetH = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, targetW, targetH);

  tex.image = canvas;
  tex.needsUpdate = true;

  if (typeof ImageBitmap !== "undefined" && src instanceof ImageBitmap) {
    src.close();
  }
};

export const buildLightweightGlassMaterial = (
  source: MeshPhysicalMaterial,
  envMapIntensity: number,
): MeshStandardMaterial => {
  const isClearTank = source.name === "CLEAR";
  const mat = new MeshStandardMaterial({
    name: source.name,
    color: source.color.clone(),
    transparent: true,
    opacity: isClearTank ? 0.62 : 0.22,
    depthWrite: false,
    roughness: 0.08,
    metalness: 0.05,
    envMapIntensity,
    emissive: isClearTank ? 0x00c853 : 0x000000,
    emissiveIntensity: isClearTank ? 0.85 : 0,
  });
  disposeMaterialTextures(source);
  source.dispose();
  return mat;
};

export interface DeskPropMaterialTuning {
  readonly envIntensity?: number;
  readonly optimizeGlass?: boolean;
  readonly colorCap: number;
}

export const tuneDeskPropMaterial = (
  mat: Material,
  tuning: DeskPropMaterialTuning,
  materials: Set<Material>,
  textures: Set<Texture>,
): { readonly material: Material; readonly castsShadow: boolean } => {
  if (tuning.optimizeGlass && mat instanceof MeshPhysicalMaterial && mat.transmission > 0) {
    const light = buildLightweightGlassMaterial(mat, 1.35);
    materials.add(light);
    return { material: light, castsShadow: false };
  }
  materials.add(mat);
  if (!(mat instanceof MeshStandardMaterial)) return { material: mat, castsShadow: true };
  mat.envMapIntensity = tuning.envIntensity ?? 0.88;
  if (mat.map) {
    clampPbrTextureBudget(mat.map, tuning.colorCap);
    mat.map.anisotropy = 4;
    textures.add(mat.map);
  }
  for (const tex of [mat.roughnessMap, mat.metalnessMap, mat.normalMap, mat.emissiveMap]) {
    if (!tex) continue;
    clampPbrTextureBudget(tex, tex === mat.emissiveMap ? tuning.colorCap : 512);
    tex.anisotropy = 2;
    textures.add(tex);
  }
  if (tuning.optimizeGlass && mat.name === "Screen") mat.emissiveIntensity = 1.35;
  return { material: mat, castsShadow: true };
};
