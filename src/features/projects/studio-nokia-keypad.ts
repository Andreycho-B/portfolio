import {
  CanvasTexture,
  Mesh,
  MeshStandardMaterial,
  NoColorSpace,
  type Object3D,
  PlaneGeometry,
} from "three";

export type NokiaMoveDir = "up" | "down" | "left" | "right";
export type NokiaKeyShape = "pill" | "navi" | "clear" | "rocker";

export type NokiaButtonId =
  | "call"
  | "snake"
  | "back"
  | "key_1"
  | "key_2"
  | "key_3"
  | "key_4"
  | "key_5"
  | "key_6"
  | "key_7"
  | "key_8"
  | "key_9"
  | "key_star"
  | "key_0"
  | "key_hash";

export interface NokiaKeySpec {
  readonly id: NokiaButtonId;
  readonly shape: NokiaKeyShape;
  readonly x: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
  readonly h: number;
  readonly rotY: number;
  readonly bridgeLift?: number;
}

export const NOKIA_FRONT_Y = 0.0758;
export const NOKIA_PRESS_DEPTH = 0.0038;

export const NOKIA_KEY_SPECS: readonly NokiaKeySpec[] = [
  {
    id: "call",
    shape: "navi",
    x: 0,
    z: 0.029,
    w: 0.102,
    d: 0.027,
    h: 0.0056,
    rotY: 0,
    bridgeLift: 0.0024,
  },
  {
    id: "back",
    shape: "clear",
    x: -0.078,
    z: 0.06,
    w: 0.06,
    d: 0.032,
    h: 0.0052,
    rotY: -0.48,
    bridgeLift: 0.0024,
  },
  {
    id: "snake",
    shape: "rocker",
    x: 0.068,
    z: 0.064,
    w: 0.098,
    d: 0.035,
    h: 0.0054,
    rotY: 0.52,
    bridgeLift: 0.0024,
  },
  { id: "key_1", shape: "pill", x: -0.082, z: 0.129, w: 0.06, d: 0.031, h: 0.0062, rotY: -0.19 },
  { id: "key_2", shape: "pill", x: 0, z: 0.14, w: 0.064, d: 0.032, h: 0.0062, rotY: 0 },
  { id: "key_3", shape: "pill", x: 0.082, z: 0.129, w: 0.06, d: 0.031, h: 0.0062, rotY: 0.19 },
  { id: "key_4", shape: "pill", x: -0.082, z: 0.183, w: 0.06, d: 0.031, h: 0.0062, rotY: -0.14 },
  { id: "key_5", shape: "pill", x: 0, z: 0.193, w: 0.064, d: 0.032, h: 0.0062, rotY: 0 },
  { id: "key_6", shape: "pill", x: 0.082, z: 0.183, w: 0.06, d: 0.031, h: 0.0062, rotY: 0.14 },
  { id: "key_7", shape: "pill", x: -0.082, z: 0.236, w: 0.06, d: 0.031, h: 0.0062, rotY: -0.1 },
  { id: "key_8", shape: "pill", x: 0, z: 0.246, w: 0.064, d: 0.032, h: 0.0062, rotY: 0 },
  { id: "key_9", shape: "pill", x: 0.082, z: 0.236, w: 0.06, d: 0.031, h: 0.0062, rotY: 0.1 },
  { id: "key_star", shape: "pill", x: -0.079, z: 0.289, w: 0.058, d: 0.03, h: 0.0062, rotY: -0.07 },
  { id: "key_0", shape: "pill", x: 0, z: 0.299, w: 0.062, d: 0.031, h: 0.0062, rotY: 0 },
  { id: "key_hash", shape: "pill", x: 0.079, z: 0.289, w: 0.058, d: 0.03, h: 0.0062, rotY: 0.07 },
];

export const buildNokiaShellPbrMaps = (): {
  readonly bump: CanvasTexture;
  readonly rough: CanvasTexture;
} => {
  const size = 256;
  const make = (): HTMLCanvasElement => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    return c;
  };
  const bCanvas = make();
  const rCanvas = make();
  const bCtx = bCanvas.getContext("2d");
  const rCtx = rCanvas.getContext("2d");

  if (bCtx && rCtx) {
    bCtx.fillStyle = "rgb(124,124,124)";
    bCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = "rgb(174,174,174)";
    rCtx.fillRect(0, 0, size, size);
    rCtx.beginPath();
    rCtx.roundRect(size * 0.16, size * 0.51, size * 0.278, size * 0.21, size * 0.025);
    rCtx.fillStyle = "rgb(48,48,48)";
    rCtx.fill();
  }

  const bump = new CanvasTexture(bCanvas);
  const rough = new CanvasTexture(rCanvas);
  bump.colorSpace = rough.colorSpace = NoColorSpace;
  bump.flipY = rough.flipY = false;
  bump.needsUpdate = rough.needsUpdate = true;
  return { bump, rough };
};

export const applyNokiaShellPbr = (
  nokiaModel: Object3D,
  bump: CanvasTexture,
  rough: CanvasTexture,
): void => {
  nokiaModel.traverse((node) => {
    if (!(node instanceof Mesh) || node.name === "Cube_screen_0") return;
    const mat = Array.isArray(node.material) ? node.material[0] : node.material;
    if (!(mat instanceof MeshStandardMaterial)) return;
    mat.bumpMap = bump;
    mat.bumpScale = 0.0025;
    mat.roughnessMap = rough;
    mat.roughness = 0.88;
    mat.metalness = 0.08;
    mat.envMapIntensity = 1.2;
    mat.needsUpdate = true;
  });
};

export const buildNokiaDomedLensGeo = (): PlaneGeometry => {
  const geo = new PlaneGeometry(0.218, 0.16, 10, 8);
  const pos = geo.getAttribute("position");
  for (let i = 0; i < pos.count; i += 1) {
    const nx = pos.getX(i) / 0.109;
    const ny = pos.getY(i) / 0.08;
    pos.setZ(i, Math.max(0, 1 - (nx * nx + ny * ny) * 0.52) * 0.0036);
  }
  geo.computeVertexNormals();
  return geo;
};

const SNAKE_INPUT_MAP: Readonly<Record<string, NokiaMoveDir>> = {
  ArrowUp: "up",
  w: "up",
  W: "up",
  "2": "up",
  key_2: "up",
  ArrowDown: "down",
  s: "down",
  S: "down",
  "8": "down",
  key_8: "down",
  ArrowLeft: "left",
  a: "left",
  A: "left",
  "4": "left",
  key_4: "left",
  ArrowRight: "right",
  d: "right",
  D: "right",
  "6": "right",
  key_6: "right",
};

export const resolveSnakeInputDir = (keyOrBtn: string): NokiaMoveDir | null =>
  SNAKE_INPUT_MAP[keyOrBtn] ?? null;

export const SNAKE_DIR_TO_BUTTON: Readonly<Record<NokiaMoveDir, NokiaButtonId>> = {
  up: "key_2",
  down: "key_8",
  left: "key_4",
  right: "key_6",
};
