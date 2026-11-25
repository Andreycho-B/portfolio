import {
  type BufferGeometry,
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type Texture,
} from "three";
import { TV_ROW_BUTTON_IDS, type TvRowButtonId } from "./studio-tv-buttons";
import { paintTvBrandCanvas, paintTvButtonAtlas } from "./studio-tv-keycap-paint";

const patchTextureRegion = (tex: Texture | null, mode: "albedo" | "normal"): void => {
  if (!tex || typeof document === "undefined") return;
  const src = tex.image as HTMLImageElement | ImageBitmap | HTMLCanvasElement | undefined;
  if (!src || !("width" in src) || src.width <= 0 || src.height <= 0) return;
  const c = document.createElement("canvas");
  [c.width, c.height] = [src.width, src.height];
  const ctx = c.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const [sx, sy] = [c.width / 1024, c.height / 1024];
  const [rx, ry, rw, rh] = [
    Math.floor(839 * sx),
    Math.floor(498 * sy),
    Math.ceil(15 * sx),
    Math.ceil(84 * sy),
  ];
  if (mode === "albedo") {
    ctx.drawImage(c, Math.floor(824 * sx), ry, rw, rh, rx, ry, rw, rh);
  } else {
    ctx.fillStyle = "rgb(128, 128, 255)";
    ctx.fillRect(rx, ry, rw, rh);
  }
  tex.image = c;
  tex.needsUpdate = true;
};

const mapButtonUvs = (id: TvRowButtonId, geo: BufferGeometry): void => {
  const pos = geo.getAttribute("position");
  const norm = geo.getAttribute("normal");
  const uv = geo.getAttribute("uv");
  const slot = TV_ROW_BUTTON_IDS.indexOf(id);
  if (!pos || !norm || !uv || slot < 0) return;
  const [col, row] = [slot % 4, Math.floor(slot / 4)];
  const front: number[] = [];
  let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity];
  for (let v = 0; v < pos.count; v += 1) {
    if (norm.getZ(v) > 0.9 && pos.getZ(v) > 1.186) {
      front.push(v);
      minX = Math.min(minX, pos.getX(v));
      maxX = Math.max(maxX, pos.getX(v));
      minY = Math.min(minY, pos.getY(v));
      maxY = Math.max(maxY, pos.getY(v));
    } else {
      uv.setXY(v, 0.875, 0.875);
    }
  }
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const [pad, inner] = [0.06, 0.88];
  for (const v of front) {
    const uLocal = (pos.getX(v) - minX) / spanX;
    const vLocal = 1 - (pos.getY(v) - minY) / spanY;
    uv.setXY(v, (col + pad + uLocal * inner) * 0.25, (row + pad + vLocal * inner) * 0.25);
  }
  uv.needsUpdate = true;
};

interface StudioTvDecalsHandle {
  readonly buttonMaterial: MeshStandardMaterial;
  readonly brandMesh: Mesh;
  readonly prepareButton: (id: TvRowButtonId, geo: BufferGeometry) => void;
  readonly scrubCabinetBrand: (mat: MeshStandardMaterial) => void;
  readonly dispose: () => void;
}

export const createStudioTvDecals = (): StudioTvDecalsHandle => {
  const atlasTex = new CanvasTexture(paintTvButtonAtlas());
  atlasTex.colorSpace = SRGBColorSpace;
  atlasTex.flipY = false;
  atlasTex.minFilter = LinearMipmapLinearFilter;
  atlasTex.magFilter = LinearFilter;
  atlasTex.anisotropy = 8;

  const buttonMaterial = new MeshStandardMaterial({
    map: atlasTex,
    roughness: 0.44,
    metalness: 0.06,
    envMapIntensity: 0.88,
  });

  const brandTex = new CanvasTexture(paintTvBrandCanvas());
  brandTex.colorSpace = SRGBColorSpace;
  brandTex.wrapS = brandTex.wrapT = ClampToEdgeWrapping;
  brandTex.minFilter = LinearMipmapLinearFilter;
  brandTex.magFilter = LinearFilter;
  brandTex.anisotropy = 8;

  const brandGeo = new PlaneGeometry(0.34, 0.0425);
  const brandMat = new MeshStandardMaterial({
    map: brandTex,
    transparent: true,
    depthWrite: false,
    roughness: 0.44,
    metalness: 0.06,
    envMapIntensity: 0.92,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const brandMesh = new Mesh(brandGeo, brandMat);
  brandMesh.name = "retroTvBrandDecal";
  brandMesh.position.set(0, -0.6897, 1.1892);
  brandMesh.visible = false;
  brandMesh.updateMatrix();
  brandMesh.updateMatrixWorld(true);
  brandMesh.matrixAutoUpdate = false;

  return {
    buttonMaterial,
    brandMesh,
    prepareButton: mapButtonUvs,
    scrubCabinetBrand: (mat) => {
      patchTextureRegion(mat.map, "albedo");
      patchTextureRegion(mat.normalMap, "normal");
      brandMesh.visible = true;
    },
    dispose: () => {
      for (const r of [atlasTex, buttonMaterial, brandTex, brandGeo, brandMat]) r.dispose();
    },
  };
};
