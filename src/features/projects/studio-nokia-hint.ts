import {
  type Camera,
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
} from "three";
import type { NokiaMoveDir } from "./studio-nokia-keypad";

interface StudioNokiaHintHandle {
  readonly mesh: Mesh;
  readonly flashDirection: (dir: NokiaMoveDir) => void;
  readonly update: (
    dtSeconds: number,
    camera: Camera,
    isFocused: boolean,
    zoomProgress: number,
    inSnakeMode: boolean,
  ) => boolean;
  readonly dispose: () => void;
}

const FONT_FAMILY = '"Author", system-ui, -apple-system, sans-serif';
const [TEX_W, TEX_H, PLANE_W] = [512, 408, 0.3];
const PLANE_H = (PLANE_W * TEX_H) / TEX_W;
const DESKTOP_POS: readonly [number, number, number] = [0.39, 0.014, 0.06];
const PORTRAIT_POS: readonly [number, number, number] = [0, 0.014, 0.5];
const [KEY_SIZE, KEY_GAP, KEY_RADIUS, FLASH_SEC] = [108, 18, 22, 0.18];
const DIRS: readonly NokiaMoveDir[] = ["up", "left", "down", "right"];
const DIR_ROT: Readonly<Record<NokiaMoveDir, number>> = {
  up: 0,
  right: Math.PI * 0.5,
  down: Math.PI,
  left: -Math.PI * 0.5,
};
const KEY_POS: Readonly<Record<NokiaMoveDir, readonly [number, number]>> = {
  up: [TEX_W * 0.5 - KEY_SIZE * 0.5, 34],
  left: [TEX_W * 0.5 - KEY_SIZE * 1.5 - KEY_GAP, 34 + KEY_SIZE + KEY_GAP],
  down: [TEX_W * 0.5 - KEY_SIZE * 0.5, 34 + KEY_SIZE + KEY_GAP],
  right: [TEX_W * 0.5 + KEY_SIZE * 0.5 + KEY_GAP, 34 + KEY_SIZE + KEY_GAP],
};

const drawArrow = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  dir: NokiaMoveDir,
  color: string,
): void => {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(DIR_ROT[dir]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4.5;
  ctx.lineCap = ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(0, 15);
  ctx.lineTo(0, -14);
  ctx.moveTo(-11, -3);
  ctx.lineTo(0, -15);
  ctx.lineTo(11, -3);
  ctx.stroke();
  ctx.restore();
};

const paintHint = (
  ctx: CanvasRenderingContext2D,
  activeDir: NokiaMoveDir | null,
  isTouch: boolean,
): void => {
  ctx.clearRect(0, 0, TEX_W, TEX_H);
  ctx.save();
  for (const dir of DIRS) {
    const [x, y] = KEY_POS[dir];
    const active = activeDir === dir;
    ctx.beginPath();
    ctx.roundRect(x, y, KEY_SIZE, KEY_SIZE, KEY_RADIUS);
    ctx.fillStyle = active ? "rgba(255, 255, 255, 0.92)" : "rgba(255, 255, 255, 0.08)";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = active ? "#ffffff" : "rgba(255, 255, 255, 0.82)";
    ctx.stroke();
    drawArrow(ctx, x + KEY_SIZE * 0.5, y + KEY_SIZE * 0.5, dir, active ? "#1a1714" : "#ffffff");
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  ctx.font = `600 36px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(isTouch ? "DESLIZA O PULSA" : "FLECHAS", TEX_W * 0.5, 338);
  ctx.restore();
};

export const createStudioNokiaHint = (onReady?: () => void): StudioNokiaHintHandle => {
  const canvas = document.createElement("canvas");
  [canvas.width, canvas.height] = [TEX_W, TEX_H];
  const ctx = canvas.getContext("2d");
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.anisotropy = 4;

  const geometry = new PlaneGeometry(PLANE_W, PLANE_H);
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "nokiaKeyboardHint3D";
  mesh.rotation.x = -Math.PI * 0.5;
  mesh.position.set(DESKTOP_POS[0], DESKTOP_POS[1], DESKTOP_POS[2]);
  mesh.updateMatrix();
  mesh.matrixAutoUpdate = mesh.visible = false;
  mesh.renderOrder = 6;

  const mq = (q: string): boolean => typeof window !== "undefined" && window.matchMedia(q).matches;
  const isTouch = mq("(hover: none) and (pointer: coarse)");
  const prefersReduced = mq("(prefers-reduced-motion: reduce)");
  const s = { portrait: false, disposed: false, opacity: 0, flash: 0 };
  let activeDir: NokiaMoveDir | null = null;
  const repaint = (): void => {
    if (!ctx || s.disposed) return;
    paintHint(ctx, activeDir, isTouch);
    texture.needsUpdate = true;
  };
  repaint();
  if (typeof document !== "undefined" && document.fonts) {
    void document.fonts
      .load('600 36px "Author"')
      .then(() => {
        if (s.disposed) return;
        repaint();
        onReady?.();
      })
      .catch((err: unknown) => console.warn("[StudioNokiaHint] Font load failed:", err));
  }
  const flashDirection = (dir: NokiaMoveDir): void => {
    const changed = activeDir !== dir;
    activeDir = dir;
    s.flash = FLASH_SEC;
    if (changed) repaint();
  };
  const update = (
    dtSeconds: number,
    camera: Camera,
    isFocused: boolean,
    zoomProgress: number,
    inSnakeMode: boolean,
  ): boolean => {
    const dt = Math.min(Math.max(dtSeconds, 0), 0.05);
    let flashing = false;
    if (activeDir !== null) {
      s.flash -= dt;
      if (s.flash <= 0) {
        activeDir = null;
        s.flash = 0;
        repaint();
      } else flashing = true;
    }
    const portrait = camera instanceof PerspectiveCamera && camera.aspect < 0.92;
    if (portrait !== s.portrait) {
      s.portrait = portrait;
      const pos = portrait ? PORTRAIT_POS : DESKTOP_POS;
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.updateMatrix();
    }
    const target = isFocused && inSnakeMode ? MathUtils.smoothstep(zoomProgress, 0.45, 0.88) : 0;
    if (prefersReduced) s.opacity = target;
    else {
      s.opacity += (target - s.opacity) * (1 - Math.exp(-(target > s.opacity ? 7.5 : 12) * dt));
      if (Math.abs(target - s.opacity) < 0.004) s.opacity = target;
    }
    mesh.visible = s.opacity > 0.004;
    if (mesh.visible) material.opacity = s.opacity;
    return flashing || Math.abs(target - s.opacity) > 0.004;
  };
  return {
    mesh,
    flashDirection,
    update,
    dispose: () => {
      s.disposed = true;
      for (const r of [geometry, material, texture]) r.dispose();
    },
  };
};
