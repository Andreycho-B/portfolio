import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, type WebGLRenderer } from "three";
import { PROFILE } from "../../core/profile";
import { PROJECT_COUNT, PROJECTS } from "./project-data";
import type { StudioAssetTracker } from "./studio-loading-tracker";

export interface StudioCrtEditorialHandle {
  readonly texture: CanvasTexture;
  readonly update: (activeIndex: number, soundEnabled: boolean, emailCopied?: boolean) => void;
  readonly dispose: () => void;
}

const TEX_W = 1600;
const TEX_H = 1120;
const TEX_SCALE = 0.8;
const PAD_X = 112;
const PAD_Y = 88;
const FONT_DISPLAY = '"Author", system-ui, -apple-system, sans-serif';
const FONT_TEXT = '"Karrik", system-ui, -apple-system, sans-serif';

const buildWhiteLogoCanvas = (img: HTMLImageElement): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || 128;
  c.height = img.naturalHeight || 156;
  const cx = c.getContext("2d");
  if (!cx) return c;
  cx.drawImage(img, 0, 0, c.width, c.height);
  cx.globalCompositeOperation = "source-in";
  cx.fillStyle = "#ffffff";
  cx.fillRect(0, 0, c.width, c.height);
  return c;
};

const drawChevron = (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void => {
  const s = size / 16;
  ctx.save();
  ctx.translate(cx - size * 0.5, cy - size * 0.5);
  ctx.beginPath();
  ctx.moveTo(6 * s, 3.5 * s);
  ctx.lineTo(10.5 * s, 8 * s);
  ctx.lineTo(6 * s, 12.5 * s);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(2.2, 1.3 * s);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
};

export const createStudioCrtEditorial = (
  renderer: WebGLRenderer,
  onAssetLoaded: () => void,
  tracker?: StudioAssetTracker,
): StudioCrtEditorialHandle => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(TEX_W * TEX_SCALE);
  canvas.height = Math.round(TEX_H * TEX_SCALE);
  const ctx = canvas.getContext("2d");

  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  let whiteLogo: HTMLCanvasElement | null = null;
  let fontsReady = false;
  let isDisposed = false;
  let lastKey = "";
  let currentState = { activeIndex: 0, soundEnabled: true, emailCopied: false };

  const redraw = (): void => {
    if (!ctx) return;
    const { activeIndex, soundEnabled, emailCopied } = currentState;
    const safeIdx = ((activeIndex % PROJECT_COUNT) + PROJECT_COUNT) % PROJECT_COUNT;
    const project = PROJECTS[safeIdx] ?? PROJECTS[0];
    ctx.setTransform(TEX_SCALE, 0, 0, TEX_SCALE, 0, 0);
    ctx.clearRect(0, 0, TEX_W, TEX_H);

    const topMidY = PAD_Y + 24;
    if (whiteLogo && whiteLogo.height > 0) {
      const targetH = 46;
      const targetW = (whiteLogo.width / whiteLogo.height) * targetH;
      ctx.drawImage(whiteLogo, PAD_X, topMidY - targetH * 0.5, targetW, targetH);
    } else {
      ctx.font = `900 34px ${FONT_DISPLAY}`;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("A", PAD_X, topMidY);
    }

    ctx.font = `400 18px ${FONT_TEXT}`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`SONIDO ${soundEnabled ? "[ON]" : "[OFF]"}`, TEX_W - PAD_X, topMidY);
    const midY = TEX_H * 0.5;
    ctx.save();
    ctx.font = `900 80px ${FONT_DISPLAY}`;
    const titleW = ctx.measureText(project.title).width;
    if (titleW > 236) ctx.font = `900 ${Math.floor((80 * 236) / titleW)}px ${FONT_DISPLAY}`;
    // Red channel = 0 tags title/year so CRT shader modulates scroll fade with zero texture upload.
    ctx.fillStyle = "#00ffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(project.title, PAD_X, midY - 12);
    ctx.font = `400 20px ${FONT_TEXT}`;
    ctx.fillStyle = "rgba(0, 255, 255, 0.9)";
    ctx.textBaseline = "top";
    ctx.fillText(project.year, PAD_X, midY + 42);
    ctx.restore();
    const chevronSize = 28;
    const aboutX = TEX_W - PAD_X - chevronSize - 8;
    ctx.font = `900 48px ${FONT_DISPLAY}`;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("sobre mí", aboutX, midY);
    drawChevron(ctx, TEX_W - PAD_X - chevronSize * 0.45, midY + 2, chevronSize);
    const botY = TEX_H - 96;
    ctx.font = `400 18px ${FONT_TEXT}`;
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(PROFILE.phone, PAD_X, botY);
    const cx = TEX_W * 0.5;
    const trackW = 84;
    const trackX = cx - trackW * 0.5;
    const thumbW = trackW / PROJECT_COUNT;
    ctx.textAlign = "right";
    ctx.fillText(`0${safeIdx + 1}`, trackX - 14, botY);
    ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
    ctx.fillRect(trackX, botY - 1, trackW, 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(trackX + safeIdx * thumbW, botY - 1, thumbW, 2);
    ctx.textAlign = "left";
    ctx.fillText(String(PROJECT_COUNT).padStart(2, "0"), trackX + trackW + 14, botY);

    ctx.textAlign = "right";
    ctx.fillText(emailCopied ? "COPIADO" : PROFILE.email.toUpperCase(), TEX_W - PAD_X, botY);

    texture.needsUpdate = true;
  };

  const logoDone = tracker?.trackTask(1, "assets", "identidad visual");
  const logoImg = new Image();
  logoImg.decoding = "async";
  logoImg.onload = () => {
    if (!isDisposed) {
      whiteLogo = buildWhiteLogoCanvas(logoImg);
      redraw();
      onAssetLoaded();
    }
    logoDone?.();
  };
  logoImg.onerror = () => logoDone?.();
  logoImg.src = "/logo.webp";
  const fontsDone = tracker?.trackTask(1, "assets", "tipografía");
  if (typeof document !== "undefined" && document.fonts) {
    void Promise.all([
      document.fonts.load('900 80px "Author"'),
      document.fonts.load('400 20px "Karrik"'),
      document.fonts.ready,
    ])
      .catch(() => {})
      .then(() => {
        if (!isDisposed) {
          fontsReady = true;
          redraw();
          onAssetLoaded();
        }
        fontsDone?.();
      });
  } else fontsDone?.();
  const update = (activeIndex: number, soundEnabled: boolean, emailCopied = false): void => {
    const key = `${activeIndex}|${soundEnabled}|${emailCopied}|${whiteLogo !== null}|${fontsReady}`;
    if (key === lastKey) return;
    lastKey = key;
    currentState = { activeIndex, soundEnabled, emailCopied };
    redraw();
  };
  redraw();
  const dispose = (): void => {
    isDisposed = true;
    logoImg.onload = logoImg.onerror = null;
    texture.dispose();
  };
  return { texture, update, dispose };
};
