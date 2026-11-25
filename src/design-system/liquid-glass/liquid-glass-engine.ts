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
import {
  bindLiquidGlassLiveListener,
  updateLiveCanvasMirror,
  withActiveLiveCanvas,
} from "./liquid-glass-live-canvas";

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

const [MAX_GLASS_DPR, LIVE_FRAME_THROTTLE_MS, PAD_2X] = [1, 50, LIQUID_GLASS_SHADOW_PAD * 2];
const surfaces = new Set<ManagedLiquidGlassSurface>();
let sharedEngine: LiquidGlass | null = null;
let scratchPair: readonly [HTMLCanvasElement, CanvasRenderingContext2D] | null = null;
let [scheduledRafId, deferredFlushTimer]: [number | null, number | null] = [null, null];
let [sharedEngineFailed, liveLoopRunning, lastLiveCanvasMs] = [false, false, 0];

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
  if (sharedEngineFailed || sharedEngine) return sharedEngine;
  try {
    sharedEngine = new LiquidGlass({ root: document.createElement("div"), glassElements: [] });
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

const getScratchBuffer = (): readonly [HTMLCanvasElement, CanvasRenderingContext2D] | null => {
  if (scratchPair) return scratchPair;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  scratchPair = [c, ctx];
  return scratchPair;
};

export const canUseLiquidGlass = (): boolean =>
  typeof window !== "undefined" &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
  getSharedEngine() !== null;

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
  const [totW, totH] = [cssW + PAD_2X, cssH + PAD_2X];
  const [pxW, pxH] = [Math.round(totW * dpr), Math.round(totH * dpr)];
  if (surface.canvas.width !== pxW || surface.canvas.height !== pxH) {
    [surface.canvas.width, surface.canvas.height] = [pxW, pxH];
  }
  [surface.lastW, surface.lastH] = [cssW, cssH];
  const sampleRect: LiquidGlassSampleRect = {
    left: rect.left + (rect.width - totW) * 0.5,
    top: rect.top + (rect.height - totH) * 0.5,
    width: totW,
    height: totH,
  };
  const excludeRoot = surface.options.getExcludeRoot?.() ?? surface.element;
  const skipFixed = surface.options.role === "detail-action";
  paintLiquidGlassBackdrop(scratch[0], scratch[1], sampleRect, dpr, excludeRoot, skipFixed);
  const config = resolveLiquidGlassConfig(surface.options.role, surface.tone, surface.buttonState);
  engine.renderer.uploadAndBlur(scratch[0], 0, 0, pxW, pxH, config.blurAmount);
  engine.renderer.clear();
  engine.renderer.renderGlassPanel(config, cssW, cssH, dpr);
  surface.ctx.clearRect(0, 0, pxW, pxH);
  surface.ctx.drawImage(engine.renderer.canvas, 0, 0, pxW, pxH, 0, 0, pxW, pxH);
  [surface.dirty, surface.lastRenderMs] = [false, nowMs];
};

const flushDirtySurfaces = (): void => {
  scheduledRafId = null;
  const now = performance.now();
  let minRetryMs = Number.POSITIVE_INFINITY;
  for (const s of surfaces) {
    if (!s.enabled || !s.dirty) continue;
    if (s.options.trackLiveCanvas && s.lastRenderMs > 0) {
      const sinceRender = now - s.lastRenderMs;
      if (sinceRender < LIVE_FRAME_THROTTLE_MS) {
        minRetryMs = Math.min(minRetryMs, LIVE_FRAME_THROTTLE_MS - sinceRender + 2);
        continue;
      }
      if (liveLoopRunning && now - lastLiveCanvasMs < 64) {
        minRetryMs = Math.min(minRetryMs, 64);
        continue;
      }
    }
    renderSingleSurface(s, now);
  }
  if (Number.isFinite(minRetryMs) && deferredFlushTimer === null && typeof window !== "undefined") {
    const delay = Math.max(16, Math.ceil(minRetryMs));
    deferredFlushTimer = window.setTimeout(() => {
      deferredFlushTimer = null;
      scheduleLiquidGlassFlush();
    }, delay);
  }
};

export const scheduleLiquidGlassFlush = (): void => {
  if (scheduledRafId !== null || typeof window === "undefined") return;
  scheduledRafId = requestAnimationFrame(flushDirtySurfaces);
};

export const registerLiquidGlassSurface = (surface: ManagedLiquidGlassSurface): void => {
  surfaces.add(surface);
  if (!surface.enabled) return;
  surface.dirty = true;
  scheduleLiquidGlassFlush();
};

export const unregisterLiquidGlassSurface = (surface: ManagedLiquidGlassSurface): void => {
  surfaces.delete(surface);
  if (surfaces.size > 0) return;
  if (scheduledRafId !== null) cancelAnimationFrame(scheduledRafId);
  if (deferredFlushTimer !== null) window.clearTimeout(deferredFlushTimer);
  [scheduledRafId, deferredFlushTimer] = [null, null];
};

bindLiquidGlassLiveListener((canvas, resting) => {
  const now = performance.now();
  [lastLiveCanvasMs, liveLoopRunning] = [now, !resting];
  if (surfaces.size === 0) return;
  if (resting) updateLiveCanvasMirror(canvas, true);
  let [hasLiveTarget, hasStaticTarget] = [false, false];
  for (const s of surfaces) {
    if (!s.enabled) continue;
    if (s.options.trackLiveCanvas) hasLiveTarget = true;
    else hasStaticTarget = true;
  }
  if (hasStaticTarget && !resting) updateLiveCanvasMirror(canvas, false);
  if (!hasLiveTarget) return;
  withActiveLiveCanvas(canvas, () => {
    for (const s of surfaces) {
      if (!s.enabled || !s.options.trackLiveCanvas) continue;
      if (!resting && s.lastRenderMs > 0 && now - s.lastRenderMs < LIVE_FRAME_THROTTLE_MS) continue;
      renderSingleSurface(s, now);
    }
  });
});
