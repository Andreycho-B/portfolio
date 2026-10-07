import { gsap } from "gsap";
import { createSpring2D } from "./spring-physics";

export interface CursorController {
  readonly enable: () => void;
  readonly disable: () => void;
  readonly setExpanded: (expanded: boolean, label?: string) => void;
  readonly setMuted: (muted: boolean) => void;
  readonly setPressed: (pressed: boolean) => void;
  readonly destroy: () => void;
}

let controllerInstance: CursorController | null = null;

export const getCursorController = (): CursorController => {
  if (controllerInstance) return controllerInstance;

  const cursorEl = document.querySelector<HTMLElement>("[data-interactive-cursor]");
  const textEl = document.querySelector<HTMLElement>("[data-cursor-text]");
  const isFinePointer =
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (!cursorEl || !isFinePointer) {
    const noop = () => {};
    controllerInstance = {
      enable: noop,
      disable: noop,
      setExpanded: noop,
      setMuted: noop,
      setPressed: noop,
      destroy: noop,
    };
    return controllerInstance;
  }

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const spring = createSpring2D();
  gsap.set(cursorEl, { xPercent: -50, yPercent: -50, force3D: true });
  const setX = gsap.quickSetter(cursorEl, "x", "px");
  const setY = gsap.quickSetter(cursorEl, "y", "px");

  let isEnabled = false;
  let hasPointerPosition = false;
  let isMoving = false;
  let rafId: number | null = null;
  let lastTimestamp = 0;

  const updateSpring = (timestamp: number) => {
    const dt = lastTimestamp === 0 ? 0.016 : Math.min((timestamp - lastTimestamp) / 1000, 0.032);
    lastTimestamp = timestamp;

    if (prefersReduced) {
      spring.currentX = spring.targetX;
      spring.currentY = spring.targetY;
      setX(spring.currentX);
      setY(spring.currentY);
      isMoving = false;
      rafId = null;
      return;
    }

    const isResting = spring.step(dt);
    setX(spring.currentX);
    setY(spring.currentY);

    if (!isResting) {
      rafId = requestAnimationFrame(updateSpring);
    } else {
      isMoving = false;
      rafId = null;
    }
  };

  const startSpringLoop = () => {
    if (!isMoving) {
      isMoving = true;
      lastTimestamp = 0;
      rafId = requestAnimationFrame(updateSpring);
    }
  };

  const handlePointerMove = (e: PointerEvent) => {
    spring.targetX = e.clientX;
    spring.targetY = e.clientY;

    if (!hasPointerPosition) {
      hasPointerPosition = true;
      spring.reset(e.clientX, e.clientY);
      setX(spring.currentX);
      setY(spring.currentY);
    }

    if (isEnabled) {
      cursorEl.classList.add("is-visible");
      startSpringLoop();
    }
  };

  const handlePointerDown = () => {
    if (isEnabled) cursorEl.classList.add("is-pressed");
  };

  const handlePointerUp = () => {
    cursorEl.classList.remove("is-pressed");
  };

  const handleMouseLeave = () => {
    cursorEl.classList.remove("is-visible");
  };

  const handleMouseEnter = () => {
    if (isEnabled && hasPointerPosition) {
      cursorEl.classList.add("is-visible");
      startSpringLoop();
    }
  };

  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("pointerdown", handlePointerDown);
  window.addEventListener("pointerup", handlePointerUp);
  document.documentElement.addEventListener("mouseleave", handleMouseLeave);
  document.documentElement.addEventListener("mouseenter", handleMouseEnter);

  const enable = () => {
    isEnabled = true;
    document.documentElement.classList.add("has-custom-cursor");
    if (hasPointerPosition) {
      cursorEl.classList.add("is-visible");
      startSpringLoop();
    }
  };

  const disable = () => {
    isEnabled = false;
    document.documentElement.classList.remove("has-custom-cursor");
    cursorEl.classList.remove("is-visible", "is-expanded", "is-pressed", "is-muted");
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
      isMoving = false;
    }
    gsap.to(cursorEl, { opacity: 0, scale: 0.4, duration: 0.25, ease: "power2.in" });
  };

  const setExpanded = (expanded: boolean, label?: string) => {
    if (!isEnabled) return;
    if (expanded) {
      if (label && textEl && textEl.textContent !== label) textEl.textContent = label;
      cursorEl.classList.add("is-expanded");
    } else {
      cursorEl.classList.remove("is-expanded");
    }
  };

  const setMuted = (muted: boolean) => {
    if (!isEnabled) return;
    cursorEl.classList.toggle("is-muted", muted);
    if (muted) cursorEl.classList.remove("is-expanded");
  };

  const setPressed = (pressed: boolean) => {
    if (!isEnabled) return;
    cursorEl.classList.toggle("is-pressed", pressed);
  };

  const destroy = () => {
    disable();
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerdown", handlePointerDown);
    window.removeEventListener("pointerup", handlePointerUp);
    document.documentElement.removeEventListener("mouseleave", handleMouseLeave);
    document.documentElement.removeEventListener("mouseenter", handleMouseEnter);
    controllerInstance = null;
  };

  controllerInstance = {
    enable,
    disable,
    setExpanded,
    setMuted,
    setPressed,
    destroy,
  };

  return controllerInstance;
};
