import * as THREE from "three";
import type { HelixCardDatum } from "./helix-cards.types";

const TEXTURE_WIDTH = 600;
const TEXTURE_HEIGHT = 850;

const drawGrain = (ctx: CanvasRenderingContext2D): void => {
  ctx.save();
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * TEXTURE_WIDTH;
    const y = Math.random() * TEXTURE_HEIGHT;
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(26, 23, 20, 0.045)" : "rgba(255, 255, 255, 0.06)";
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.restore();
};

const ART_FIELD_TOP = 52;
const ART_FIELD_BOTTOM = 596;

const drawCardFace = (ctx: CanvasRenderingContext2D, card: HelixCardDatum): void => {
  // Base clara: barra de info inferior y marco perimetral
  ctx.fillStyle = "#fdfcf8";
  ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);

  // Campo de arte en grafito cálido con degradado diagonal (grises abstractos)
  const art = ctx.createLinearGradient(0, ART_FIELD_TOP, TEXTURE_WIDTH, ART_FIELD_BOTTOM);
  art.addColorStop(0, "#312d29");
  art.addColorStop(0.55, "#413c37");
  art.addColorStop(1, "#524c45");
  ctx.fillStyle = art;
  ctx.fillRect(52, ART_FIELD_TOP, TEXTURE_WIDTH - 104, ART_FIELD_BOTTOM - ART_FIELD_TOP);

  drawGrain(ctx);

  // Índice e insignia en crema sobre el campo de arte (arte retroiluminado)
  ctx.fillStyle = "#f5f1ea";
  ctx.font = '900 210px "Author", system-ui, sans-serif';
  ctx.textBaseline = "top";
  ctx.fillText(card.index, 78, 116);

  ctx.font = '400 28px "Karrik", system-ui, sans-serif';
  ctx.fillStyle = "rgba(245, 241, 234, 0.72)";
  ctx.textAlign = "right";
  ctx.fillText(card.discipline.toUpperCase(), TEXTURE_WIDTH - 78, 128);
  ctx.textAlign = "left";

  // Barra de info inferior
  ctx.fillStyle = "#1a1714";
  ctx.fillRect(52, 656, TEXTURE_WIDTH - 104, 3);

  ctx.font = '900 54px "Author", system-ui, sans-serif';
  ctx.fillStyle = "#1a1714";
  ctx.fillText(card.name.toUpperCase(), 52, 692);

  ctx.font = '400 26px "Karrik", system-ui, sans-serif';
  ctx.fillStyle = "#6b6660";
  ctx.fillText("ANDREY — PORTAFOLIO", 52, 774);

  // Marco perimetral del acrílico
  ctx.strokeStyle = "#1a1714";
  ctx.lineWidth = 6;
  ctx.strokeRect(26, 26, TEXTURE_WIDTH - 52, TEXTURE_HEIGHT - 52);
};

const waitForSiteFonts = async (): Promise<void> => {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  await document.fonts.ready;
};

export const createCardFaceTexture = async (card: HelixCardDatum): Promise<THREE.CanvasTexture> => {
  await waitForSiteFonts();

  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible para la textura de tarjeta");

  drawCardFace(ctx, card);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};
