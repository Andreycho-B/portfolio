import {
  type Camera,
  CanvasTexture,
  ClampToEdgeWrapping,
  DoubleSide,
  LinearFilter,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Scene,
  SRGBColorSpace,
  Vector3,
} from "three";
import type { StudioFocusTarget } from "./studio-prop-focus";

const TITLE_TEXT = "Portafolio";
const TITLE_ANCHOR = new Vector3(0, 1.84, 0);
const TV_FORWARD = new Vector3(0, 0, 1);
const FONT_FAMILY = '"Author", system-ui, -apple-system, sans-serif';
const FONT_WEIGHT = 900;
const TEX_W = 1024;
const TEX_H = 256;
const TITLE_W = 2.24;
const TITLE_H = (TITLE_W * TEX_H) / TEX_W;

export interface StudioTvTitleHandle {
  readonly update: (
    dtSeconds: number,
    camera: Camera,
    zoomProgress: number,
    activeFocus: StudioFocusTarget | null,
  ) => boolean;
  readonly dispose: () => void;
}

const paintTitle = (ctx: CanvasRenderingContext2D): void => {
  ctx.clearRect(0, 0, TEX_W, TEX_H);
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const maxWidth = TEX_W - 64;
  const baseSize = 148;
  ctx.font = `${FONT_WEIGHT} ${baseSize}px ${FONT_FAMILY}`;
  const measured = ctx.measureText(TITLE_TEXT).width;
  if (measured > maxWidth) {
    ctx.font = `${FONT_WEIGHT} ${Math.floor((baseSize * maxWidth) / measured)}px ${FONT_FAMILY}`;
  }
  ctx.fillText(TITLE_TEXT, TEX_W * 0.5, TEX_H * 0.52);
  ctx.restore();
};

export const createStudioTvTitle = (
  targetScene: Scene,
  onReady?: () => void,
): StudioTvTitleHandle => {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext("2d");

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.anisotropy = 2;

  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const geometry = new PlaneGeometry(TITLE_W, TITLE_H);
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: prefersReduced ? 1 : 0,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    side: DoubleSide,
  });

  const mesh = new Mesh(geometry, material);
  mesh.name = "studioTvTitle3D";
  mesh.position.copy(TITLE_ANCHOR);
  mesh.updateMatrix();
  mesh.matrixAutoUpdate = false;
  mesh.renderOrder = 12;
  mesh.visible = prefersReduced;
  targetScene.add(mesh);

  let isDisposed = false;
  let opacity = prefersReduced ? 1 : 0;
  const toCam = new Vector3();

  const repaint = (): void => {
    if (!ctx) return;
    paintTitle(ctx);
    texture.needsUpdate = true;
  };
  repaint();

  if (typeof document !== "undefined" && document.fonts) {
    void document.fonts
      .load(`${FONT_WEIGHT} 148px "Author"`)
      .then(() => {
        if (isDisposed) return;
        repaint();
        onReady?.();
      })
      .catch((err: unknown) => console.warn("[StudioTvTitle] Font load failed:", err));
  }

  const update = (
    dtSeconds: number,
    camera: Camera,
    zoomProgress: number,
    activeFocus: StudioFocusTarget | null,
  ): boolean => {
    toCam.subVectors(camera.position, TITLE_ANCHOR).normalize();
    const facing = MathUtils.smoothstep(toCam.dot(TV_FORWARD), 0.12, 0.48);
    const showInFocus = activeFocus === null;
    const zoomFade = showInFocus ? 1 : 1 - MathUtils.smoothstep(zoomProgress, 0.12, 0.48);
    const targetOpacity = facing * zoomFade;

    if (prefersReduced) {
      opacity = targetOpacity;
    } else {
      const dt = Math.min(Math.max(dtSeconds, 0), 0.05);
      opacity +=
        (targetOpacity - opacity) * (1 - Math.exp(-(targetOpacity > opacity ? 5.5 : 10.5) * dt));
      if (Math.abs(targetOpacity - opacity) < 0.004) opacity = targetOpacity;
    }

    mesh.visible = opacity > 0.004;
    if (mesh.visible) material.opacity = opacity;
    return Math.abs(targetOpacity - opacity) > 0.004;
  };

  return {
    update,
    dispose: () => {
      isDisposed = true;
      targetScene.remove(mesh);
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
};
