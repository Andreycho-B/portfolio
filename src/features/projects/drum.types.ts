import type { ProjectTitleMorphController } from "./project-title-morph";

export interface FrontCardBounds {
  readonly widthRatio: number;
  readonly heightRatio: number;
}

export interface DrumWebGLHandle {
  setRotation: (slotPosition: number) => void;
  setScrollVelocity: (velocitySlotsPerSecond: number) => void;
  setIntroProgress: (progress: number) => void;
  render: () => void;
  resize: (widthPx: number, heightPx: number) => void;
  getFrontCardBounds: () => FrontCardBounds;
  dispose: () => void;
}

export interface DrumControllerElements {
  readonly root: HTMLElement;
  readonly viewport: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly morphController: ProjectTitleMorphController;
  readonly webglScene: DrumWebGLHandle | null;
  readonly onOpenActive: () => void;
}

export interface DrumEventHandlers {
  readonly onWheel: (e: WheelEvent) => void;
  readonly onKeyDown: (e: KeyboardEvent) => void;
  readonly onPointerDown: (e: PointerEvent) => void;
  readonly onPointerMove: (e: PointerEvent) => void;
  readonly onPointerUp: (e: PointerEvent) => void;
  readonly onPointerLeave: (e: PointerEvent) => void;
}

export const bindDrumEvents = (
  root: HTMLElement,
  viewport: HTMLElement,
  handlers: DrumEventHandlers,
): (() => void) => {
  root.addEventListener("wheel", handlers.onWheel as EventListener, { passive: false });
  window.addEventListener("keydown", handlers.onKeyDown as EventListener);
  viewport.addEventListener("pointerdown", handlers.onPointerDown as EventListener);
  viewport.addEventListener("pointermove", handlers.onPointerMove as EventListener);
  viewport.addEventListener("pointerup", handlers.onPointerUp as EventListener);
  viewport.addEventListener("pointercancel", handlers.onPointerUp as EventListener);
  viewport.addEventListener("pointerleave", handlers.onPointerLeave as EventListener);

  return () => {
    root.removeEventListener("wheel", handlers.onWheel as EventListener);
    window.removeEventListener("keydown", handlers.onKeyDown as EventListener);
    viewport.removeEventListener("pointerdown", handlers.onPointerDown as EventListener);
    viewport.removeEventListener("pointermove", handlers.onPointerMove as EventListener);
    viewport.removeEventListener("pointerup", handlers.onPointerUp as EventListener);
    viewport.removeEventListener("pointercancel", handlers.onPointerUp as EventListener);
    viewport.removeEventListener("pointerleave", handlers.onPointerLeave as EventListener);
  };
};

export const isPointOverCard = (
  clientX: number,
  clientY: number,
  rect: DOMRect,
  scene: DrumWebGLHandle | null,
): boolean => {
  if (!scene) return false;
  const bounds = scene.getFrontCardBounds();
  const dx = Math.abs(clientX - (rect.left + rect.width / 2));
  const dy = Math.abs(clientY - (rect.top + rect.height / 2));
  return dx <= (rect.width * bounds.widthRatio) / 2 && dy <= (rect.height * bounds.heightRatio) / 2;
};

export const consumeDetentStep = (
  curr: number,
  state: { prevPos: number; lastDetentPos: number },
): boolean => {
  if (curr === state.prevPos) return false;
  state.prevPos = curr;
  const diff = curr - state.lastDetentPos;
  if (Math.abs(diff) < 0.5) return false;
  state.lastDetentPos += Math.trunc(diff / 0.5) * 0.5;
  return true;
};

export const observeCanvasResize = (
  canvas: HTMLCanvasElement,
  onResize: (rect: DOMRect) => void,
): (() => void) => {
  let frameId: number | null = null;
  const trigger = () => {
    if (frameId !== null) return;
    frameId = requestAnimationFrame(() => {
      frameId = null;
      onResize(canvas.getBoundingClientRect());
    });
  };
  const observer = new ResizeObserver(trigger);
  observer.observe(canvas);
  window.addEventListener("resize", trigger);
  return () => {
    if (frameId !== null) cancelAnimationFrame(frameId);
    window.removeEventListener("resize", trigger);
    observer.disconnect();
  };
};
