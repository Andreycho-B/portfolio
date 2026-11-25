import { TV_ROW_BUTTON_IDS, type TvRowButtonId } from "./studio-tv-buttons";

const ATLAS_SIZE = 1024;
const CELL_SIZE = 256;
const ASPECT_X = 0.94;
const BODY_COLOR = "#222429";
const DIGIT_INK = "#f0f2f6";
const ACCENT_RED = "#e4493b";

const tracePoly = (
  ctx: CanvasRenderingContext2D,
  pts: readonly (readonly [number, number])[],
  close = false,
): void => {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 1) {
    const pt = pts[i];
    if (!pt) continue;
    if (i === 0) ctx.moveTo(pt[0], pt[1]);
    else ctx.lineTo(pt[0], pt[1]);
  }
  if (close) ctx.closePath();
};

const paintControlGlyph = (ctx: CanvasRenderingContext2D, id: TvRowButtonId): void => {
  ctx.strokeStyle = ctx.fillStyle = ACCENT_RED;
  ctx.lineWidth = 14;
  ctx.lineCap = ctx.lineJoin = "round";
  if (id === "ch_prev" || id === "ch_next") {
    const d = id === "ch_prev" ? -1 : 1;
    tracePoly(ctx, [
      [d * -18, -32],
      [d * 22, 0],
      [d * -18, 32],
    ]);
    ctx.stroke();
    return;
  }
  if (id === "mute") {
    tracePoly(
      ctx,
      [
        [-42, -13],
        [-20, -13],
        [4, -32],
        [4, 32],
        [-20, 13],
        [-42, 13],
      ],
      true,
    );
    ctx.fill();
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(18, -16);
    ctx.lineTo(44, 16);
    ctx.moveTo(44, -16);
    ctx.lineTo(18, 16);
    ctx.stroke();
    return;
  }
  ctx.beginPath();
  ctx.arc(0, 5, 32, -Math.PI * 0.28, Math.PI * 1.28);
  ctx.stroke();
  tracePoly(ctx, [
    [0, -37],
    [0, -3],
  ]);
  ctx.stroke();
};

export const paintTvButtonAtlas = (): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = BODY_COLOR;
  ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

  for (let i = 0; i < TV_ROW_BUTTON_IDS.length; i += 1) {
    const id = TV_ROW_BUTTON_IDS[i];
    if (!id) continue;
    const x0 = (i % 4) * CELL_SIZE;
    const y0 = Math.floor(i / 4) * CELL_SIZE;
    const grad = ctx.createLinearGradient(x0, y0, x0, y0 + CELL_SIZE);
    grad.addColorStop(0, "#30333b");
    grad.addColorStop(0.62, "#24262c");
    grad.addColorStop(0.67, "#363942");
    grad.addColorStop(0.71, "#1b1d22");
    grad.addColorStop(1, "#15171c");
    ctx.fillStyle = grad;
    ctx.fillRect(x0, y0, CELL_SIZE, CELL_SIZE);

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x0, y0, CELL_SIZE, 10);

    ctx.save();
    ctx.translate(x0 + CELL_SIZE * 0.5, y0 + CELL_SIZE * 0.34);
    ctx.scale(ASPECT_X, 1);
    if (id.startsWith("ch") && id.length === 3) {
      ctx.fillStyle = DIGIT_INK;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = '700 98px "Helvetica Neue", Arial, sans-serif';
      ctx.fillText(id.slice(2), 0, 3);
    } else {
      paintControlGlyph(ctx, id);
    }
    ctx.restore();
  }
  return canvas;
};

export const paintTvBrandCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.save();
  ctx.translate(512, 66);
  ctx.scale(1.08, 1);
  ctx.fillStyle = "#1d1f24";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '900 94px "Helvetica Neue", Arial, sans-serif';
  if ("letterSpacing" in ctx) ctx.letterSpacing = "3px";
  ctx.fillText("Panasonic", 0, 0);
  ctx.restore();
  return canvas;
};
