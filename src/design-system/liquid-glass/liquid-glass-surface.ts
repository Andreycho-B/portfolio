import type {
  LiquidGlassSurfaceHandle,
  LiquidGlassSurfaceOptions,
  LiquidGlassTone,
} from "./liquid-glass.types";
import {
  canUseLiquidGlass,
  type ManagedLiquidGlassSurface,
  registerLiquidGlassSurface,
  scheduleLiquidGlassFlush,
  unregisterLiquidGlassSurface,
} from "./liquid-glass-engine";

const NOOP_HANDLE: LiquidGlassSurfaceHandle = {
  markDirty: () => {},
  setTone: () => {},
  setPressed: () => {},
  setEnabled: () => {},
  destroy: () => {},
};

export const attachLiquidGlassSurface = (
  options: LiquidGlassSurfaceOptions,
): LiquidGlassSurfaceHandle => {
  const { element, role, interactive = false, trackScroll = false } = options;

  if (!canUseLiquidGlass()) {
    element.dataset.liquidGlass = "fallback";
    element.dataset.liquidGlassRole = role;
    return {
      ...NOOP_HANDLE,
      destroy: () => {
        delete element.dataset.liquidGlass;
        delete element.dataset.liquidGlassRole;
      },
    };
  }

  const canvas = document.createElement("canvas");
  canvas.className = "liquid-glass-surface-canvas";
  canvas.setAttribute("aria-hidden", "true");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    element.dataset.liquidGlass = "fallback";
    element.dataset.liquidGlassRole = role;
    return NOOP_HANDLE;
  }

  element.insertBefore(canvas, element.firstChild);
  element.dataset.liquidGlass = "active";
  element.dataset.liquidGlassRole = role;

  const surface: ManagedLiquidGlassSurface = {
    element,
    canvas,
    ctx,
    options,
    buttonState: { hover: false, pressed: false },
    tone: options.tone ?? "light",
    enabled: options.initialEnabled ?? true,
    dirty: true,
    lastRenderMs: 0,
    lastW: 0,
    lastH: 0,
  };

  const markDirty = (): void => {
    if (!surface.enabled) return;
    surface.dirty = true;
    scheduleLiquidGlassFlush();
  };

  const setTone = (tone: LiquidGlassTone): void => {
    if (surface.tone === tone) return;
    surface.tone = tone;
    markDirty();
  };

  const setPressed = (pressed: boolean): void => {
    if (surface.buttonState.pressed === pressed) return;
    surface.buttonState.pressed = pressed;
    markDirty();
  };

  const setEnabled = (enabled: boolean): void => {
    if (surface.enabled === enabled) return;
    surface.enabled = enabled;
    if (enabled) {
      surface.dirty = true;
      scheduleLiquidGlassFlush();
    } else {
      surface.dirty = false;
      surface.lastRenderMs = 0;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const cleanups: Array<() => void> = [];

  if (interactive) {
    const onOver = () => {
      surface.buttonState.hover = true;
      markDirty();
    };
    const onOut = () => {
      surface.buttonState.hover = false;
      surface.buttonState.pressed = false;
      markDirty();
    };
    const onDown = () => {
      surface.buttonState.pressed = true;
      markDirty();
    };
    const onUp = () => {
      surface.buttonState.pressed = false;
      markDirty();
    };
    element.addEventListener("pointerover", onOver);
    element.addEventListener("pointerout", onOut);
    element.addEventListener("pointerdown", onDown);
    element.addEventListener("pointerup", onUp);
    element.addEventListener("pointercancel", onUp);
    cleanups.push(() => {
      element.removeEventListener("pointerover", onOver);
      element.removeEventListener("pointerout", onOut);
      element.removeEventListener("pointerdown", onDown);
      element.removeEventListener("pointerup", onUp);
      element.removeEventListener("pointercancel", onUp);
    });
  }

  const onResize = () => markDirty();
  window.addEventListener("resize", onResize, { passive: true });
  cleanups.push(() => window.removeEventListener("resize", onResize));

  if (trackScroll) {
    const onScroll = () => markDirty();
    window.addEventListener("scroll", onScroll, { passive: true });
    cleanups.push(() => window.removeEventListener("scroll", onScroll));
  }

  if (typeof ResizeObserver !== "undefined" && !options.getFixedSize) {
    const ro = new ResizeObserver(() => markDirty());
    ro.observe(element);
    cleanups.push(() => ro.disconnect());
  }

  registerLiquidGlassSurface(surface);

  const destroy = (): void => {
    unregisterLiquidGlassSurface(surface);
    for (const fn of cleanups) fn();
    canvas.remove();
    delete element.dataset.liquidGlass;
    delete element.dataset.liquidGlassRole;
  };

  return { markDirty, setTone, setPressed, setEnabled, destroy };
};
