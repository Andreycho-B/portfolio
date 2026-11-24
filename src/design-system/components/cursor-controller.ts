import { gsap } from "gsap";
import { attachTvIframeBridge, getStudioTvBridge } from "../../core/tv-portal-bridge";
import type { CursorController } from "./cursor.types";
import { createCursorState, NOOP_CONTROLLER } from "./cursor.types";
import { bindCursorEvents, bindCursorLiquidGlass, registerCursorSwapReset } from "./cursor-events";
import { initCursorTransforms } from "./cursor-transforms";
import { createSpring2D, stepCursorSpring } from "./spring-physics";

export type { CursorController };

let controllerInstance: CursorController | null = null;

export const getCursorController = (): CursorController => {
  const tvBridge = getStudioTvBridge();
  if (tvBridge) {
    attachTvIframeBridge(tvBridge);
    return tvBridge.cursor;
  }
  const cursorEl = document.querySelector<HTMLElement>("[data-interactive-cursor]");
  if (controllerInstance && controllerInstance !== NOOP_CONTROLLER && cursorEl?.isConnected) {
    return controllerInstance;
  }
  const dotEl = document.querySelector<HTMLElement>("[data-cursor-dot]");
  const ringEl = document.querySelector<HTMLElement>("[data-cursor-ring]");
  const textEl = document.querySelector<HTMLElement>("[data-cursor-text]");
  const isFinePointer =
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!cursorEl || !isFinePointer) {
    controllerInstance = NOOP_CONTROLLER;
    return controllerInstance;
  }
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const spring = createSpring2D();
  const transforms = initCursorTransforms(cursorEl, ringEl, dotEl);
  const state = createCursorState();
  const glass = bindCursorLiquidGlass(cursorEl);
  const syncAnchor = () =>
    transforms.syncAnchor(spring.targetX, spring.targetY, state.expanded, state.muted);
  const syncGlass = () => {
    syncAnchor();
    glass.sync(state.expanded, state.muted, state.inverted, state.pressed);
  };

  const toggleSharedClass = (cls: string, force: boolean): void => {
    cursorEl.classList.toggle(cls, force);
    dotEl?.classList.toggle(cls, force);
  };
  const updateSpring = (time: number) => {
    const dt = state.lastTime === 0 ? 0.012 : Math.min((time - state.lastTime) / 1000, 0.032);
    state.lastTime = time;
    if (prefersReduced) {
      spring.reset(spring.targetX, spring.targetY);
      transforms.apply(spring.currentX, spring.currentY, 0, 1, 1);
      state.moving = false;
      state.rafId = null;
      return;
    }
    const canDeform = !state.expanded && !state.muted && Date.now() > state.morphUntil;
    const res = stepCursorSpring(spring, dt, canDeform, state.angle);
    state.angle = res.angle;
    transforms.apply(res.x, res.y, res.angle, res.scaleX, res.scaleY);
    glass.markMoved();
    if (!res.isResting) {
      state.rafId = requestAnimationFrame(updateSpring);
    } else {
      state.moving = false;
      state.rafId = null;
    }
  };
  const startSpringLoop = () => {
    if (state.moving) return;
    state.moving = true;
    state.lastTime = performance.now();
    state.rafId = requestAnimationFrame(updateSpring);
  };
  const moveTo = (clientX: number, clientY: number): void => {
    transforms.setDot(clientX, clientY);
    spring.targetX = clientX;
    spring.targetY = clientY;
    if (syncAnchor()) glass.markMoved();
    if (!state.hasPos) {
      state.hasPos = true;
      spring.reset(clientX, clientY);
      transforms.apply(clientX, clientY, 0, 1, 1);
    }
    if (state.enabled) {
      toggleSharedClass("is-visible", true);
      startSpringLoop();
    }
  };
  const setPressed = (pressed: boolean) => {
    if (!state.enabled || state.pressed === pressed) return;
    state.pressed = pressed;
    toggleSharedClass("is-pressed", pressed);
    syncGlass();
  };
  const unbindEvents = bindCursorEvents({
    onMove: moveTo,
    onDown: () => setPressed(true),
    onUp: () => setPressed(false),
    onLeave: () => toggleSharedClass("is-visible", false),
    onEnter: () => {
      if (state.enabled && state.hasPos) {
        toggleSharedClass("is-visible", true);
        startSpringLoop();
      }
    },
  });
  const enable = () => {
    state.enabled = true;
    gsap.set(cursorEl, { clearProps: "opacity,scale" });
    document.documentElement.classList.add("has-custom-cursor");
    if (state.hasPos) {
      toggleSharedClass("is-visible", true);
      startSpringLoop();
    }
  };
  const disable = () => {
    Object.assign(state, {
      enabled: false,
      expanded: false,
      muted: false,
      pressed: false,
      inverted: false,
    });
    syncGlass();
    document.documentElement.classList.remove("has-custom-cursor");
    cursorEl.classList.remove("is-visible", "is-expanded", "is-pressed", "is-muted", "is-inverted");
    dotEl?.classList.remove("is-visible", "is-pressed", "is-inverted");
    if (state.rafId !== null) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
      state.moving = false;
    }
    transforms.resetRing();
    gsap.to(cursorEl, { opacity: 0, scale: 0.4, duration: 0.2, ease: "power2.in" });
  };
  const setExpanded = (expanded: boolean, label?: string) => {
    if (!state.enabled) return;
    if (expanded && textEl) {
      const nextLabel = label || "Ver";
      if (textEl.textContent !== nextLabel) textEl.textContent = nextLabel;
    }
    if (state.expanded !== expanded || cursorEl.classList.contains("is-expanded") !== expanded) {
      state.expanded = expanded;
      cursorEl.classList.toggle("is-expanded", expanded);
      transforms.resetRing();
      state.morphUntil = Date.now() + 200;
    }
    if (expanded) {
      state.muted = false;
      cursorEl.classList.remove("is-muted");
    }
    syncGlass();
  };
  const setMuted = (muted: boolean) => {
    if (!state.enabled || state.muted === muted) return;
    state.muted = muted;
    cursorEl.classList.toggle("is-muted", muted);
    if (muted && state.expanded) {
      state.expanded = false;
      cursorEl.classList.remove("is-expanded");
    }
    transforms.resetRing();
    state.morphUntil = Date.now() + 200;
    syncGlass();
  };
  const setInverted = (inverted: boolean) => {
    if (!state.enabled || state.inverted === inverted) return;
    state.inverted = inverted;
    toggleSharedClass("is-inverted", inverted);
    syncGlass();
  };
  const pulse = () => {
    if (state.enabled) transforms.pulseRing();
  };
  const destroy = () => {
    disable();
    glass.destroy();
    unbindEvents();
    controllerInstance = null;
  };
  controllerInstance = {
    enable,
    disable,
    moveTo,
    setExpanded,
    setMuted,
    setPressed,
    setInverted,
    pulse,
    destroy,
  };
  return controllerInstance;
};

registerCursorSwapReset(() => controllerInstance);
