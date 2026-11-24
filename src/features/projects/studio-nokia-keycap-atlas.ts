import { type BufferGeometry, CanvasTexture, SRGBColorSpace } from "three";
import type { NokiaButtonId } from "./studio-nokia-keypad";

interface KeyLegendSpec {
  readonly cell: readonly [number, number];
  readonly main: string;
  readonly sub?: string;
  readonly aspectX: number;
  readonly cluster?: boolean;
}

// aspectX compensates each key's physical width/depth ratio so printed legends never look stretched
const KEY_LEGENDS: Readonly<Record<NokiaButtonId, KeyLegendSpec>> = {
  call: { cell: [0, 0], main: "", aspectX: 0.27, cluster: true },
  back: { cell: [1, 0], main: "C", aspectX: 0.53, cluster: true },
  snake: { cell: [2, 0], main: "ARROWS", aspectX: 0.36, cluster: true },
  key_1: { cell: [3, 0], main: "1", sub: "oo", aspectX: 0.52 },
  key_2: { cell: [0, 1], main: "2", sub: "abc", aspectX: 0.5 },
  key_3: { cell: [1, 1], main: "3", sub: "def", aspectX: 0.52 },
  key_4: { cell: [2, 1], main: "4", sub: "ghi", aspectX: 0.52 },
  key_5: { cell: [3, 1], main: "5", sub: "jkl", aspectX: 0.5 },
  key_6: { cell: [0, 2], main: "6", sub: "mno", aspectX: 0.52 },
  key_7: { cell: [1, 2], main: "7", sub: "pqrs", aspectX: 0.52 },
  key_8: { cell: [2, 2], main: "8", sub: "tuv", aspectX: 0.5 },
  key_9: { cell: [3, 2], main: "9", sub: "wxyz", aspectX: 0.52 },
  key_star: { cell: [0, 3], main: "*", sub: "+", aspectX: 0.52 },
  key_0: { cell: [1, 3], main: "0", sub: "␣", aspectX: 0.5 },
  key_hash: { cell: [2, 3], main: "#", sub: "⇧", aspectX: 0.52 },
};

const drawVoicemailGlyph = (ctx: CanvasRenderingContext2D, cx: number, cy: number): void => {
  ctx.strokeStyle = "#161d28";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(cx - 17, cy, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + 17, cy, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 17, cy + 10);
  ctx.lineTo(cx + 17, cy + 10);
  ctx.stroke();
};

const drawArrowRockerGlyphs = (ctx: CanvasRenderingContext2D): void => {
  ctx.strokeStyle = "#171f2c";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Classic Nokia 3310 left/right rocker chevrons with compensated proportions
  ctx.beginPath();
  ctx.moveTo(-125, -24);
  ctx.lineTo(-158, 0);
  ctx.lineTo(-125, 24);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(125, -24);
  ctx.lineTo(158, 0);
  ctx.lineTo(125, 24);
  ctx.stroke();
};

const paintKeycapCell = (
  ctx: CanvasRenderingContext2D,
  id: NokiaButtonId,
  spec: KeyLegendSpec,
): void => {
  const cellPx = 256;
  const x0 = spec.cell[0] * cellPx;
  const y0 = spec.cell[1] * cellPx;
  const cx = x0 + cellPx * 0.5;
  const cy = y0 + cellPx * 0.5;

  // Cool silver-pearl tone calibrated against warm golden-hour sunlight
  const grad = ctx.createRadialGradient(cx, cy - 12, 16, cx, cy, 152);
  if (spec.cluster) {
    grad.addColorStop(0, "#cfd6e0");
    grad.addColorStop(0.62, "#b5becb");
    grad.addColorStop(1, "#8d97a6");
  } else {
    grad.addColorStop(0, "#d8dfe9");
    grad.addColorStop(0.58, "#bec7d4");
    grad.addColorStop(1, "#909aa9");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(x0, y0, cellPx, cellPx);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(spec.aspectX, 1);

  if (id === "call") {
    ctx.fillStyle = "#0e67d1";
    ctx.beginPath();
    ctx.roundRect(-140, -16, 280, 32, 16);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (id === "snake") {
    drawArrowRockerGlyphs(ctx);
    ctx.restore();
    return;
  }

  ctx.fillStyle = "#161d28";
  ctx.textBaseline = "middle";
  if (id === "back") {
    ctx.font = "700 96px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("C", 0, 4);
    ctx.restore();
    return;
  }

  ctx.font = "700 96px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(spec.main, -12, 4);

  if (id === "key_1") {
    drawVoicemailGlyph(ctx, 48, 6);
  } else if (spec.sub) {
    ctx.font = "600 48px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(spec.sub, 8, 8);
  }
  ctx.restore();
};

export const createNokiaKeycapAtlas = (): CanvasTexture => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(0.5, 0.5);
    const entries = Object.entries(KEY_LEGENDS) as readonly [NokiaButtonId, KeyLegendSpec][];
    for (const [id, spec] of entries) paintKeycapCell(ctx, id, spec);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.flipY = false;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
};

export const mapNokiaKeycapUvs = (geo: BufferGeometry, id: NokiaButtonId): void => {
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  const pos = geo.getAttribute("position");
  const uv = geo.getAttribute("uv");
  if (!box || !pos || !uv) return;

  const [col, row] = KEY_LEGENDS[id].cell;
  const spanX = Math.max(1e-5, box.max.x - box.min.x);
  const spanZ = Math.max(1e-5, box.max.z - box.min.z);
  const margin = 0.08;
  const inner = 1 - margin * 2;

  for (let i = 0; i < pos.count; i += 1) {
    const uLocal = (pos.getX(i) - box.min.x) / spanX;
    const vLocal = (pos.getZ(i) - box.min.z) / spanZ;
    uv.setXY(i, (col + margin + uLocal * inner) * 0.25, (row + margin + vLocal * inner) * 0.25);
  }
  uv.needsUpdate = true;
};
