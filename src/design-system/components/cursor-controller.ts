import { gsap } from "gsap";
import { createSpring2D } from "./spring-physics";

export interface CursorController {
  readonly enable: () => void;
  readonly disable: () => void;
  readonly setExpanded: (expanded: boolean, label?: string) => void;
  readonly setMuted: (muted: boolean) => void;
  readonly setPressed: (pressed: boolean) => void;
  readonly setInverted: (inverted: boolean) => void;
  readonly pulse: () => void;
  readonly destroy: () => void;
}

const NOOP_CONTROLLER: CursorController = new Proxy({} as CursorController, {
  get: () => () => {},
});
let controllerInstance: CursorController | null = null;

export const getCursorController = (): CursorController => {
  if (controllerInstance) return controllerInstance;

  const cursorEl = document.querySelector<HTMLElement>("[data-interactive-cursor]");
  const textEl = document.querySelector<HTMLElement>("[data-cursor-text]");
  const isFinePointer =
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (!cursorEl || !isFinePointer) {
    return NOOP_CONTROLLER;
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
    const dt = lastTimestamp === 0 ? 0.008 : Math.min((timestamp - lastTimestamp) / 1000, 0.032);
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
    isEnabled && cursorEl.classList.add("is-pressed");
  };
  const handlePointerUp = () => cursorEl.classList.remove("is-pressed");
  const handleMouseLeave = () => cursorEl.classList.remove("is-visible");
  const handleMouseEnter = () => {
    if (isEnabled && hasPointerPosition) {
      cursorEl.classList.add("is-visible");
      startSpringLoop();
    }
  };

  const attachEvents = (add: boolean) => {
    const method = add ? "addEventListener" : "removeEventListener";
    window[method]("pointermove", handlePointerMove as EventListener, { passive: true });
    window[method]("pointerdown", handlePointerDown);
    window[method]("pointerup", handlePointerUp);
    document.documentElement[method]("mouseleave", handleMouseLeave);
    document.documentElement[method]("mouseenter", handleMouseEnter);
  };
  attachEvents(true);

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
    cursorEl.classList.remove("is-visible", "is-expanded", "is-pressed", "is-muted", "is-inverted");
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
      isMoving = false;
    }
    gsap.to(cursorEl, { opacity: 0, scale: 0.4, duration: 0.25, ease: "power2.in" });
  };

  let isExpandedState = false;
  let isMutedState = false;
  let isPressedState = false;
  let isInvertedState = false;

  const setExpanded = (expanded: boolean, label?: string) => {
    if (!isEnabled) return;
    if (expanded && label && textEl && textEl.textContent !== label) textEl.textContent = label;
    if (isExpandedState !== expanded) {
      isExpandedState = expanded;
      cursorEl.classList.toggle("is-expanded", expanded);
    }
  };

  const setMuted = (muted: boolean) => {
    if (!isEnabled || isMutedState === muted) return;
    isMutedState = muted;
    cursorEl.classList.toggle("is-muted", muted);
    if (muted && isExpandedState) {
      isExpandedState = false;
      cursorEl.classList.remove("is-expanded");
    }
  };

  const setPressed = (pressed: boolean) => {
    if (!isEnabled || isPressedState === pressed) return;
    isPressedState = pressed;
    cursorEl.classList.toggle("is-pressed", pressed);
  };
  const setInverted = (inverted: boolean) => {
    if (!isEnabled || isInvertedState === inverted) return;
    isInvertedState = inverted;
    cursorEl.classList.toggle("is-inverted", inverted);
  };

  const pulse = () => {
    if (!isEnabled) return;
    gsap
      .timeline()
      .to(cursorEl, { scale: 0.82, duration: 0.16, ease: "power1.in", force3D: true })
      .to(cursorEl, { scale: 1, duration: 0.38, ease: "back.out(1.5)", force3D: true });
  };

  const destroy = () => {
    disable();
    attachEvents(false);
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
