import type { LiquidGlassSampleRect } from "./liquid-glass.types";

const SNAPSHOT_MAX_W = 1280;
const SNAPSHOT_MIN_INTERVAL_MS = 180;

interface LiveCanvasMirror {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  lastCaptureMs: number;
}

const canvasMirrors = new WeakMap<HTMLCanvasElement, LiveCanvasMirror>();
let activeLiveCanvas: HTMLCanvasElement | null = null;
type LiveFrameListener = (canvas: HTMLCanvasElement, resting: boolean) => void;
let liveFrameListener: LiveFrameListener | null = null;

export const bindLiquidGlassLiveListener = (listener: LiveFrameListener | null): void => {
  liveFrameListener = listener;
};

const finePointerQuery =
  typeof window !== "undefined" ? window.matchMedia("(hover: hover) and (pointer: fine)") : null;
const reducedMotionQuery =
  typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

export const notifyLiquidGlassLiveFrame = (canvas: HTMLCanvasElement, resting = false): void => {
  if (liveFrameListener) {
    liveFrameListener(canvas, resting);
    return;
  }
  if (resting && finePointerQuery?.matches && !reducedMotionQuery?.matches) {
    updateLiveCanvasMirror(canvas, true);
  }
};

const getOrCreateMirror = (source: HTMLCanvasElement): LiveCanvasMirror | null => {
  const existing = canvasMirrors.get(source);
  if (existing) return existing;
  const mirrorCanvas = document.createElement("canvas");
  const mirrorCtx = mirrorCanvas.getContext("2d");
  if (!mirrorCtx) return null;
  const created: LiveCanvasMirror = {
    canvas: mirrorCanvas,
    ctx: mirrorCtx,
    lastCaptureMs: 0,
  };
  canvasMirrors.set(source, created);
  return created;
};

export const updateLiveCanvasMirror = (source: HTMLCanvasElement, force = false): void => {
  if (source.width <= 0 || source.height <= 0) return;
  const mirror = getOrCreateMirror(source);
  if (!mirror) return;
  const now = performance.now();
  if (!force && mirror.lastCaptureMs > 0 && now - mirror.lastCaptureMs < SNAPSHOT_MIN_INTERVAL_MS) {
    return;
  }
  const scale = Math.min(1, SNAPSHOT_MAX_W / source.width);
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  if (mirror.canvas.width !== w || mirror.canvas.height !== h) {
    mirror.canvas.width = w;
    mirror.canvas.height = h;
  }
  try {
    mirror.ctx.clearRect(0, 0, w, h);
    mirror.ctx.drawImage(source, 0, 0, source.width, source.height, 0, 0, w, h);
    mirror.lastCaptureMs = now;
  } catch (err: unknown) {
    if (!(err instanceof DOMException)) {
      console.warn("[LiquidGlassLiveCanvas] Mirror capture failed:", err);
    }
  }
};

export const withActiveLiveCanvas = (canvas: HTMLCanvasElement, run: () => void): void => {
  const prev = activeLiveCanvas;
  activeLiveCanvas = canvas;
  try {
    run();
  } finally {
    activeLiveCanvas = prev;
  }
};

export const drawLiveCanvasRegion = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  sampleRect: LiquidGlassSampleRect,
): boolean => {
  const rect = source.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const drawable =
    activeLiveCanvas === source
      ? source
      : (canvasMirrors.get(source)?.canvas ?? (source.width > 0 ? source : null));
  if (!drawable || drawable.width <= 0 || drawable.height <= 0) return false;

  const scaleX = drawable.width / rect.width;
  const scaleY = drawable.height / rect.height;
  const rawSx = (sampleRect.left - rect.left) * scaleX;
  const rawSy = (sampleRect.top - rect.top) * scaleY;
  const rawSw = sampleRect.width * scaleX;
  const rawSh = sampleRect.height * scaleY;

  const sx = Math.max(0, Math.min(drawable.width - 1, rawSx));
  const sy = Math.max(0, Math.min(drawable.height - 1, rawSy));
  const sw = Math.max(1, Math.min(drawable.width - sx, rawSw - (sx - rawSx)));
  const sh = Math.max(1, Math.min(drawable.height - sy, rawSh - (sy - rawSy)));

  const dx = rect.left + sx / scaleX;
  const dy = rect.top + sy / scaleY;
  const dw = sw / scaleX;
  const dh = sh / scaleY;

  try {
    ctx.drawImage(drawable, sx, sy, sw, sh, dx, dy, dw, dh);
    return true;
  } catch (err: unknown) {
    if (!(err instanceof DOMException)) {
      console.warn("[LiquidGlassLiveCanvas] Region blit failed:", err);
    }
    return false;
  }
};
