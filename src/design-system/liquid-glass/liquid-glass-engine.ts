import { LiquidGlass } from "@ybouane/liquidglass";
import {
  LIQUID_GLASS_SHADOW_PAD,
  type LiquidGlassButtonState,
  type LiquidGlassSampleRect,
  type LiquidGlassSurfaceOptions,
  type LiquidGlassTone,
  resolveLiquidGlassConfig,
} from "./liquid-glass.types";
import { paintLiquidGlassBackdrop } from "./liquid-glass-backdrop";
import { updateLiveCanvasMirror, withActiveLiveCanvas } from "./liquid-glass-live-canvas";

export interface ManagedLiquidGlassSurface {
  readonly element: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly options: LiquidGlassSurfaceOptions;
  readonly buttonState: LiquidGlassButtonState;
  tone: LiquidGlassTone;
  enabled: boolean;
  dirty: boolean;
  lastRenderMs: number;
  lastW: number;
  lastH: number;
}

const MAX_GLASS_DPR = 1;
const LIVE_FRAME_THROTTLE_MS = 50;

const surfaces = new Set<ManagedLiquidGlassSurface>();
let sharedEngine: LiquidGlass | null = null;
let sharedEngineFailed = false;
let scratchCanvas: HTMLCanvasElement | null = null;
let scratchCtx: CanvasRenderingContext2D | null = null;
let scheduledRafId: number | null = null;
let lastLiveCanvasMs = 0;

const handleEngineResize = (): void => {
  if (!sharedEngine || sharedEngine.renderer.contextLost) return;
  sharedEngine.renderer.resize(0, 0);
  for (const s of surfaces) s.dirty = true;
  scheduleLiquidGlassFlush();
};

const disposeSharedEngine = (): void => {
  window.removeEventListener("resize", handleEngineResize);
  if (!sharedEngine) return;
  try {
    const loseExt = sharedEngine.renderer.gl.getExtension("WEBGL_lose_context");
    sharedEngine.destroy();
    loseExt?.loseContext();
  } catch (err: unknown) {
    console.warn("[LiquidGlassEngine] Dispose warning:", err);
  }
  sharedEngine = null;
};

const getSharedEngine = (): LiquidGlass | null => {
  if (sharedEngineFailed) return null;
  if (sharedEngine) return sharedEngine;
  try {
    const detachedRoot = document.createElement("div");
    sharedEngine = new LiquidGlass({ root: detachedRoot, glassElements: [] });
    sharedEngine.renderer.canvas.addEventListener("webglcontextrestored", () => {
      for (const s of surfaces) s.dirty = true;
      scheduleLiquidGlassFlush();
    });
    window.addEventListener("resize", handleEngineResize, { passive: true });
    window.addEventListener("pagehide", disposeSharedEngine, { once: true });
    return sharedEngine;
  } catch (err: unknown) {
    sharedEngineFailed = true;
    console.warn("[LiquidGlassEngine] WebGL initialization failed, using CSS fallback:", err);
    return null;
  }
};

const getScratchBuffer = (): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} | null => {
  if (scratchCanvas && scratchCtx) return { canvas: scratchCanvas, ctx: scratchCtx };
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  [scratchCanvas, scratchCtx] = [c, ctx];
  return { canvas: c, ctx };
};

export const canUseLiquidGlass = (): boolean => {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return getSharedEngine() !== null;
};

const renderSingleSurface = (surface: ManagedLiquidGlassSurface, nowMs: number): void => {
  if (!surface.enabled || !surface.element.isConnected) return;
  const engine = getSharedEngine();
  const scratch = getScratchBuffer();
  if (!engine || !scratch || engine.renderer.contextLost) return;

  const fixedSize = surface.options.getFixedSize?.() ?? null;
  const rect = surface.element.getBoundingClientRect();
  const cssW = Math.round(fixedSize ? fixedSize.width : surface.element.offsetWidth);
  const cssH = Math.round(fixedSize ? fixedSize.height : surface.element.offsetHeight);
  if (cssW <= 4 || cssH <= 4 || rect.width <= 1 || rect.height <= 1) return;

  const dpr = Math.min(window.devicePixelRatio || 1, MAX_GLASS_DPR);
  const pad = LIQUID_GLASS_SHADOW_PAD;
  const [totalCssW, totalCssH] = [cssW + pad * 2, cssH + pad * 2];
  const [pxW, pxH] = [Math.round(totalCssW * dpr), Math.round(totalCssH * dpr)];
  if (surface.canvas.width !== pxW || surface.canvas.height !== pxH) {
    [surface.canvas.width, surface.canvas.height] = [pxW, pxH];
  }
  [surface.lastW, surface.lastH] = [cssW, cssH];
  const sampleRect: LiquidGlassSampleRect = {
    left: rect.left + rect.width * 0.5 - totalCssW * 0.5,
    top: rect.top + rect.height * 0.5 - totalCssH * 0.5,
    width: totalCssW,
    height: totalCssH,
  };
  const excludeRoot = surface.options.getExcludeRoot?.() ?? surface.element;
  const skipFixedDom = surface.options.role === "detail-action";
  paintLiquidGlassBackdrop(scratch.canvas, scratch.ctx, sampleRect, dpr, excludeRoot, skipFixedDom);
  const config = resolveLiquidGlassConfig(surface.options.role, surface.tone, surface.buttonState);
  engine.renderer.uploadAndBlur(scratch.canvas, 0, 0, pxW, pxH, config.blurAmount);
  engine.renderer.clear();
  engine.renderer.renderGlassPanel(config, cssW, cssH, dpr);
  surface.ctx.clearRect(0, 0, pxW, pxH);
  surface.ctx.drawImage(engine.renderer.canvas, 0, 0, pxW, pxH, 0, 0, pxW, pxH);
  surface.dirty = false;
  surface.lastRenderMs = nowMs;
};

const flushDirtySurfaces = (): void => {
  scheduledRafId = null;
  const now = performance.now();
  for (const surface of surfaces) {
    if (!surface.enabled || !surface.dirty) continue;
    const isLive = surface.options.trackLiveCanvas && surface.lastRenderMs > 0;
    if (
      isLive &&
      (now - lastLiveCanvasMs < 120 || now - surface.lastRenderMs < LIVE_FRAME_THROTTLE_MS)
    ) {
      continue;
    }
    renderSingleSurface(surface, now);
  }
};

export const scheduleLiquidGlassFlush = (): void => {
  if (scheduledRafId !== null || typeof window === "undefined") return;
  scheduledRafId = requestAnimationFrame(flushDirtySurfaces);
};

export const registerLiquidGlassSurface = (surface: ManagedLiquidGlassSurface): void => {
  surfaces.add(surface);
  if (surface.enabled) {
    surface.dirty = true;
    scheduleLiquidGlassFlush();
  }
};

export const unregisterLiquidGlassSurface = (surface: ManagedLiquidGlassSurface): void => {
  surfaces.delete(surface);
  if (surfaces.size === 0 && scheduledRafId !== null) {
    cancelAnimationFrame(scheduledRafId);
    scheduledRafId = null;
  }
};

export const notifyLiquidGlassLiveFrame = (canvas: HTMLCanvasElement): void => {
  const now = performance.now();
  lastLiveCanvasMs = now;
  if (surfaces.size === 0) return;

  let hasLiveTarget = false;
  let hasStaticTarget = false;
  for (const surface of surfaces) {
    if (!surface.enabled) continue;
    if (surface.options.trackLiveCanvas) hasLiveTarget = true;
    else hasStaticTarget = true;
  }
  if (hasStaticTarget) updateLiveCanvasMirror(canvas, false);
  if (!hasLiveTarget) return;

  withActiveLiveCanvas(canvas, () => {
    for (const surface of surfaces) {
      if (!surface.enabled || !surface.options.trackLiveCanvas) continue;
      if (surface.lastRenderMs > 0 && now - surface.lastRenderMs < LIVE_FRAME_THROTTLE_MS) continue;
      renderSingleSurface(surface, now);
    }
  });
};
