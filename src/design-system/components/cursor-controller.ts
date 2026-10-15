import { gsap } from "gsap";
import type { CursorController } from "./cursor.types";
import { createCursorState, NOOP_CONTROLLER } from "./cursor.types";
import { bindCursorEvents } from "./cursor-events";
import { createSpring2D, stepCursorSpring } from "./spring-physics";

export type { CursorController };

let controllerInstance: CursorController | null = null;

export const getCursorController = (): CursorController => {
  if (controllerInstance) return controllerInstance;

  const cursorEl = document.querySelector<HTMLElement>("[data-interactive-cursor]");
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
  gsap.set(cursorEl, { xPercent: -50, yPercent: -50, force3D: true });
  const setX = gsap.quickSetter(cursorEl, "x", "px");
  const setY = gsap.quickSetter(cursorEl, "y", "px");
  const setRot = ringEl ? gsap.quickSetter(ringEl, "rotation", "deg") : () => {};
  const setScaleX = ringEl ? gsap.quickSetter(ringEl, "scaleX") : () => {};
  const setScaleY = ringEl ? gsap.quickSetter(ringEl, "scaleY") : () => {};
  const state = createCursorState();

  const resetRing = () => {
    setRot(0);
    setScaleX(1);
    setScaleY(1);
  };

  const applyTransforms = (x: number, y: number, rot: number, sx: number, sy: number) => {
    setX(x);
    setY(y);
    setRot(rot);
    setScaleX(sx);
    setScaleY(sy);
  };

  const updateSpring = (time: number) => {
    const dt = state.lastTime === 0 ? 0.008 : Math.min((time - state.lastTime) / 1000, 0.032);
    state.lastTime = time;

    if (prefersReduced) {
      spring.currentX = spring.targetX;
      spring.currentY = spring.targetY;
      applyTransforms(spring.currentX, spring.currentY, 0, 1, 1);
      state.moving = false;
      state.rafId = null;
      return;
    }

    const canDeform = !state.expanded && !state.muted && Date.now() > state.morphUntil;
    const res = stepCursorSpring(spring, dt, canDeform, state.angle);
    state.angle = res.angle;
    applyTransforms(res.x, res.y, res.angle, res.scaleX, res.scaleY);

    if (!res.isResting) {
      state.rafId = requestAnimationFrame(updateSpring);
    } else {
      state.moving = false;
      state.rafId = null;
    }
  };

  const startSpringLoop = () => {
    if (!state.moving) {
      state.moving = true;
      state.lastTime = 0;
      state.rafId = requestAnimationFrame(updateSpring);
    }
  };

  const unbindEvents = bindCursorEvents({
    onMove: (clientX, clientY) => {
      spring.targetX = clientX;
      spring.targetY = clientY;
      if (!state.hasPos) {
        state.hasPos = true;
        spring.reset(clientX, clientY);
        applyTransforms(clientX, clientY, 0, 1, 1);
      }
      if (state.enabled) {
        cursorEl.classList.add("is-visible");
        startSpringLoop();
      }
    },
    onDown: () => state.enabled && cursorEl.classList.add("is-pressed"),
    onUp: () => cursorEl.classList.remove("is-pressed"),
    onLeave: () => cursorEl.classList.remove("is-visible"),
    onEnter: () => {
      if (state.enabled && state.hasPos) {
        cursorEl.classList.add("is-visible");
        startSpringLoop();
      }
    },
  });

  const enable = () => {
    state.enabled = true;
    gsap.set(cursorEl, { clearProps: "opacity,scale" });
    document.documentElement.classList.add("has-custom-cursor");
    if (state.hasPos) {
      cursorEl.classList.add("is-visible");
      startSpringLoop();
    }
  };

  const disable = () => {
    state.enabled = false;
    document.documentElement.classList.remove("has-custom-cursor");
    cursorEl.classList.remove("is-visible", "is-expanded", "is-pressed", "is-muted", "is-inverted");
    if (state.rafId !== null) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
      state.moving = false;
    }
    resetRing();
    gsap.to(cursorEl, { opacity: 0, scale: 0.4, duration: 0.25, ease: "power2.in" });
  };

  const setExpanded = (expanded: boolean, label?: string) => {
    if (!state.enabled) return;
    if (expanded && label && textEl && textEl.textContent !== label) textEl.textContent = label;
    if (state.expanded !== expanded) {
      state.expanded = expanded;
      cursorEl.classList.toggle("is-expanded", expanded);
      resetRing();
      state.morphUntil = Date.now() + 380;
    }
  };

  const setMuted = (muted: boolean) => {
    if (!state.enabled || state.muted === muted) return;
    state.muted = muted;
    cursorEl.classList.toggle("is-muted", muted);
    if (muted && state.expanded) {
      state.expanded = false;
      cursorEl.classList.remove("is-expanded");
    }
    resetRing();
    state.morphUntil = Date.now() + 380;
  };

  const setPressed = (pressed: boolean) => {
    if (!state.enabled || state.pressed === pressed) return;
    state.pressed = pressed;
    cursorEl.classList.toggle("is-pressed", pressed);
  };

  const setInverted = (inverted: boolean) => {
    if (!state.enabled || state.inverted === inverted) return;
    state.inverted = inverted;
    cursorEl.classList.toggle("is-inverted", inverted);
  };

  const pulse = () => {
    if (!state.enabled) return;
    gsap
      .timeline()
      .to(cursorEl, { scale: 0.92, duration: 0.12, ease: "power1.in", force3D: true })
      .to(cursorEl, { scale: 1, duration: 0.28, ease: "back.out(1.2)", force3D: true });
  };

  const destroy = () => {
    disable();
    unbindEvents();
    controllerInstance = null;
  };

  controllerInstance = {
    enable,
    disable,
    setExpanded,
    setMuted,
    setPressed,
    setInverted,
    pulse,
    destroy,
  };
  return controllerInstance;
};
