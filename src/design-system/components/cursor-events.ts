import type { LiquidGlassSurfaceHandle } from "../liquid-glass/liquid-glass.types";
import type { CursorController } from "./cursor.types";

interface CursorEventHandlers {
  readonly onMove: (clientX: number, clientY: number) => void;
  readonly onDown: () => void;
  readonly onUp: () => void;
  readonly onLeave: () => void;
  readonly onEnter: () => void;
}

export const bindCursorEvents = (handlers: CursorEventHandlers): (() => void) => {
  const handlePointerMove = (e: PointerEvent) => handlers.onMove(e.clientX, e.clientY);
  const handlePointerDown = () => handlers.onDown();
  const handlePointerUp = () => handlers.onUp();
  const handleMouseLeave = () => handlers.onLeave();
  const handleMouseEnter = () => handlers.onEnter();

  window.addEventListener("pointermove", handlePointerMove as EventListener, { passive: true });
  window.addEventListener("pointerdown", handlePointerDown);
  window.addEventListener("pointerup", handlePointerUp);
  window.addEventListener("pointercancel", handlePointerUp);
  window.addEventListener("blur", handlePointerUp);
  document.documentElement.addEventListener("mouseleave", handleMouseLeave);
  document.documentElement.addEventListener("mouseenter", handleMouseEnter);

  return () => {
    window.removeEventListener("pointermove", handlePointerMove as EventListener);
    window.removeEventListener("pointerdown", handlePointerDown);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerUp);
    window.removeEventListener("blur", handlePointerUp);
    document.documentElement.removeEventListener("mouseleave", handleMouseLeave);
    document.documentElement.removeEventListener("mouseenter", handleMouseEnter);
  };
};

export const bindCursorExpandTriggers = (
  root: ParentNode,
  cursor: CursorController,
): (() => void) => {
  const elements = Array.from(root.querySelectorAll<HTMLElement>("[data-cursor-expand]"));
  const cleanups = elements.map((el) => {
    const label = el.dataset.cursorExpand;
    const onEnter = () => cursor.setExpanded(true, label);
    const onLeave = () => cursor.setExpanded(false);
    const onClick = () => {
      cursor.setExpanded(false);
      cursor.setPressed(false);
    };
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("click", onClick);
    };
  });

  return () => {
    for (const fn of cleanups) fn();
  };
};

interface CursorLiquidGlassBinding {
  readonly sync: (expanded: boolean, muted: boolean, inverted: boolean, pressed: boolean) => void;
  readonly markMoved: () => void;
  readonly destroy: () => void;
}

export const bindCursorLiquidGlass = (cursorEl: HTMLElement): CursorLiquidGlassBinding => {
  const pillEl = cursorEl.querySelector<HTMLElement>(".cursor-pill");
  if (!pillEl) {
    return { sync: () => {}, markMoved: () => {}, destroy: () => {} };
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    pillEl.dataset.liquidGlass = "fallback";
    pillEl.dataset.liquidGlassRole = "cursor-pill";
    return {
      sync: () => {},
      markMoved: () => {},
      destroy: () => {
        delete pillEl.dataset.liquidGlass;
        delete pillEl.dataset.liquidGlassRole;
      },
    };
  }
  let isExpanded = false;
  let isMuted = false;
  let isInverted = false;
  let isPressed = false;
  let isDestroyed = false;
  let surface: LiquidGlassSurfaceHandle | null = null;
  void import("../liquid-glass/liquid-glass-surface")
    .then(({ attachLiquidGlassSurface }) => {
      if (isDestroyed) return;
      const active = isExpanded || isMuted;
      surface = attachLiquidGlassSurface({
        element: pillEl,
        role: "cursor-pill",
        tone: isInverted ? "dark" : "light",
        initialEnabled: active,
        trackScroll: true,
        trackLiveCanvas: true,
        getFixedSize: () => {
          if (isMuted) return { width: 44, height: 44 };
          if (isExpanded) return { width: 140, height: 42 };
          return null;
        },
        getExcludeRoot: () => cursorEl,
      });
      surface.setPressed(isPressed);
      if (active) surface.markDirty();
    })
    .catch((err: unknown) => {
      console.warn("[CursorLiquidGlass] Fallback activated:", err);
      pillEl.dataset.liquidGlass = "fallback";
      pillEl.dataset.liquidGlassRole = "cursor-pill";
    });
  const onTransitionEnd = (e: TransitionEvent) => {
    if (
      e.propertyName === "width" ||
      e.propertyName === "height" ||
      e.propertyName === "translate"
    ) {
      surface?.markDirty();
    }
  };
  pillEl.addEventListener("transitionend", onTransitionEnd);
  return {
    sync: (expanded, muted, inverted, pressed) => {
      isExpanded = expanded;
      isMuted = muted;
      isInverted = inverted;
      isPressed = pressed;
      if (!surface) return;
      const active = expanded || muted;
      surface.setTone(inverted ? "dark" : "light");
      surface.setPressed(pressed);
      surface.setEnabled(active);
      if (active) surface.markDirty();
    },
    markMoved: () => {
      if (isExpanded || isMuted) surface?.markDirty();
    },
    destroy: () => {
      isDestroyed = true;
      pillEl.removeEventListener("transitionend", onTransitionEnd);
      surface?.destroy();
      surface = null;
    },
  };
};

export const registerCursorSwapReset = (getActive: () => CursorController | null): void => {
  if (typeof document === "undefined") return;
  const resetState = () => {
    const active = getActive();
    active?.setExpanded(false);
    active?.setMuted(false);
    active?.setPressed(false);
    active?.setInverted(false);
    document
      .querySelector<HTMLElement>("[data-interactive-cursor]")
      ?.classList.remove("is-expanded", "is-pressed", "is-muted", "is-inverted");
    document
      .querySelector<HTMLElement>("[data-cursor-dot]")
      ?.classList.remove("is-pressed", "is-inverted");
    const textEl = document.querySelector<HTMLElement>("[data-cursor-text]");
    if (textEl) textEl.textContent = "Ver";
  };
  for (const evt of ["astro:before-swap", "astro:after-swap", "astro:page-load"] as const) {
    document.addEventListener(evt, resetState);
  }
};
