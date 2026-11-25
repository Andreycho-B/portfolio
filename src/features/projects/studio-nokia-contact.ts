import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Object3D,
  SRGBColorSpace,
} from "three";
import { PROFILE } from "../../core/profile";
import {
  drawLcdBitmap,
  drawLcdText,
  fillLcdRect,
  LCD_CANVAS_H,
  LCD_CANVAS_W,
  LCD_H,
  LCD_W,
  measureLcdText,
  type PixelBuffer,
  setLcdPixel,
} from "./studio-nokia-font";

const ANTENNA_ICON: readonly string[] = ["#.#.#", ".###.", "..#..", "..#..", "..#.."];
const BATTERY_ICON: readonly string[] = [".##.", "#..#", "####", "####", "####", "####"];
const SNAKE_HINT_ICON: readonly string[] = ["..#..", ".#.#.", "#...#", ".#.#.", "..#.."];

export const formatLocalHM = (now: Date): string => {
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

const splitPhoneLines = (rawPhone: string): readonly [string, string] => {
  const tokens = rawPhone.trim().split(/\s+/);
  if (tokens.length >= 4) return [`${tokens[0]} ${tokens[1]}`, `${tokens[2]} ${tokens[3]}`];
  const mid = Math.ceil(rawPhone.length * 0.5);
  return [rawPhone.slice(0, mid).trim(), rawPhone.slice(mid).trim()];
};

const contactFrameBuf = new Uint8Array(LCD_W * LCD_H);

export const composeNokiaContactFrame = (
  timeLabel: string,
  statusNotice: string | null,
): PixelBuffer => {
  const buf = contactFrameBuf;
  buf.fill(0);

  drawLcdBitmap(buf, ANTENNA_ICON, 2, 4);
  fillLcdRect(buf, 2, 11, 4, 6);
  fillLcdRect(buf, 2, 19, 3, 6);
  fillLcdRect(buf, 2, 27, 2, 6);
  fillLcdRect(buf, 2, 35, 2, 6);

  drawLcdBitmap(buf, BATTERY_ICON, 78, 4);
  fillLcdRect(buf, 78, 12, 4, 6);
  fillLcdRect(buf, 79, 20, 3, 6);
  fillLcdRect(buf, 80, 28, 2, 6);
  fillLcdRect(buf, 80, 36, 2, 6);

  drawLcdText(buf, "ANDREY", 10, 4, "mini");
  drawLcdText(buf, timeLabel, 75 - measureLcdText(timeLabel, "mini"), 4, "mini");
  for (let x = 10; x <= 74; x += 2) setLcdPixel(buf, x, 11);

  if (statusNotice) {
    const nx = Math.round((LCD_W - measureLcdText(statusNotice, "mini")) * 0.5);
    drawLcdText(buf, statusNotice, nx, 22, "mini");
  } else {
    const [line1, line2] = splitPhoneLines(PROFILE.phone);
    drawLcdText(
      buf,
      line1,
      Math.round((LCD_W - measureLcdText(line1, "large")) * 0.5),
      15,
      "large",
    );
    drawLcdText(
      buf,
      line2,
      Math.round((LCD_W - measureLcdText(line2, "large")) * 0.5),
      25,
      "large",
    );
  }

  fillLcdRect(buf, 27, 36, 30, 1);
  const softkey = "Llamar";
  drawLcdText(
    buf,
    softkey,
    Math.round((LCD_W - measureLcdText(softkey, "mini")) * 0.5),
    39,
    "mini",
  );
  drawLcdBitmap(buf, SNAKE_HINT_ICON, 66, 39);
  return buf;
};

const SCREEN_U_MIN = 0.1711;
const SCREEN_U_SPAN = 0.4241 - SCREEN_U_MIN;
const SCREEN_V_MIN = 0.5229;
const SCREEN_V_SPAN = 0.7098 - SCREEN_V_MIN;

export const createNokiaLcdSurface = (): {
  readonly ctx: CanvasRenderingContext2D | null;
  readonly texture: CanvasTexture;
} => {
  const canvas = document.createElement("canvas");
  canvas.width = LCD_CANVAS_W;
  canvas.height = LCD_CANVAS_H;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 4;
  return { ctx: canvas.getContext("2d"), texture };
};

export const bindNokiaScreenSurface = (nokiaRoot: Object3D, texture: CanvasTexture): void => {
  nokiaRoot.traverse((node) => {
    if (!(node instanceof Mesh) || node.name !== "Cube_screen_0") return;
    const uv = node.geometry.getAttribute("uv");
    if (uv) {
      for (let i = 0; i < uv.count; i += 1) {
        const nu = Math.max(0, Math.min(1, (uv.getX(i) - SCREEN_U_MIN) / SCREEN_U_SPAN));
        const nv = Math.max(0, Math.min(1, (uv.getY(i) - SCREEN_V_MIN) / SCREEN_V_SPAN));
        uv.setXY(i, nu, nv);
      }
      uv.needsUpdate = true;
    }
    const mat = Array.isArray(node.material) ? node.material[0] : node.material;
    if (!(mat instanceof MeshStandardMaterial)) return;
    mat.map = mat.emissiveMap = texture;
    mat.emissive.setHex(0xd4f08a);
    mat.emissiveIntensity = 0.68;
    mat.metalness = 0.04;
    mat.roughness = 0.06;
    mat.envMapIntensity = 2.6;
    if (mat instanceof MeshPhysicalMaterial) {
      mat.clearcoat = 1.0;
      mat.clearcoatRoughness = 0.02;
    }
    mat.needsUpdate = true;
  });
};
