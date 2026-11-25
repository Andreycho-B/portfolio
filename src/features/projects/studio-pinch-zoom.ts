import type { StudioInputDeps } from "./studio.types";
import { classifyStudioHoverZone } from "./studio-screen-hit";

const MIN_PINCH_SPAN_PX = 8;
const PINCH_ZOOM_GAIN = 1.18;
const MAX_PINCH_STEP = 0.28;
const WHEEL_LINE_PX = 16;
const WHEEL_PAGE_PX = 320;
const WHEEL_PX_PER_SLOT = 180;
const WHEEL_SNAP_IDLE_MS = 240;
const WHEEL_ZOOM_GAIN = 0.0014;
const TRACKPAD_PINCH_GAIN = 0.0085;
const MAX_WHEEL_ZOOM_STEP = 0.32;

export const STUDIO_IGNORE_SURFACE_SEL =
  "[data-studio-tv-portal], [data-studio-sound-toggle], [data-studio-back-btn]";

export const normStudioXY = (x: number, y: number): readonly [number, number] => [
  (x / Math.max(1, innerWidth)) * 2 - 1,
  1 - (y / Math.max(1, innerHeight)) * 2,
];

export const handleStudioShowcaseDblClick = (e: MouseEvent, deps: StudioInputDeps): void => {
  if (deps.getFocusTarget() !== null) return;
  if (e.target instanceof Element && e.target.closest(STUDIO_IGNORE_SURFACE_SEL)) return;
  const [nx, ny] = normStudioXY(e.clientX, e.clientY);
  const z = classifyStudioHoverZone(deps.scene, nx, ny, deps.power.isPoweredOn, null);
  if (z === "power" || z === "tv_button" || z === "prop_zoom" || z === "chair_sit") return;
  deps.scene.cycleShowcaseAngle();
  deps.cursor.pulse();
  deps.requestFrame();
};

export const createStudioEmailFeedback = (
  deps: StudioInputDeps,
): { readonly notifyCopied: () => void; readonly dispose: () => void } => {
  let resetTimer: number | null = null;
  return {
    notifyCopied: () => {
      deps.scene.setEmailCopied(true);
      if (resetTimer !== null) window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        resetTimer = null;
        deps.scene.setEmailCopied(false);
        deps.requestFrame();
      }, 2000);
      deps.requestFrame();
    },
    dispose: () => {
      if (resetTimer !== null) window.clearTimeout(resetTimer);
      resetTimer = null;
    },
  };
};

interface TouchCoords {
  x: number;
  y: number;
}

interface StudioPinchZoomTracker {
  readonly onPointerDown: (event: PointerEvent) => boolean;
  readonly onPointerMove: (event: PointerEvent) => number | null;
  readonly onPointerUp: (event: PointerEvent) => boolean;
  readonly reset: () => void;
}

const clampStep = (amount: number, limit: number): number =>
  Math.max(-limit, Math.min(limit, amount));

const normalizeWheelPx = (event: WheelEvent): number => {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * WHEEL_LINE_PX;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * WHEEL_PAGE_PX;
  return event.deltaY;
};

export const createStudioWheelHandler = (
  deps: StudioInputDeps,
): { readonly onWheel: (event: WheelEvent) => void; readonly dispose: () => void } => {
  const { scene, physics, autoplay, power } = deps;
  let wheelSnapTimer: number | null = null;

  const onWheel = (event: WheelEvent): void => {
    if (deps.getFocusTarget() === "tv" && deps.isTvPortalOpen()) return;
    event.preventDefault();
    const wheelPx = normalizeWheelPx(event);
    if (deps.getFocusTarget() !== "tv") {
      const gain = event.ctrlKey ? TRACKPAD_PINCH_GAIN : WHEEL_ZOOM_GAIN;
      scene.addDistanceScaleDelta(clampStep(wheelPx * gain, MAX_WHEEL_ZOOM_STEP));
      deps.requestFrame();
      return;
    }
    if (!power.isPoweredOn) return;
    const delta = wheelPx / WHEEL_PX_PER_SLOT;
    autoplay.notifyUserInteraction(delta);
    physics.addDeltaSlots(delta);
    if (wheelSnapTimer !== null) window.clearTimeout(wheelSnapTimer);
    wheelSnapTimer = window.setTimeout(() => {
      wheelSnapTimer = null;
      physics.snapToNearestSlot();
      deps.requestFrame();
    }, WHEEL_SNAP_IDLE_MS);
    deps.requestFrame();
  };

  const dispose = (): void => {
    if (wheelSnapTimer !== null) window.clearTimeout(wheelSnapTimer);
    wheelSnapTimer = null;
  };

  return { onWheel, dispose };
};

export const createStudioPinchZoom = (): StudioPinchZoomTracker => {
  const touches = new Map<number, TouchCoords>();
  let prevSpan = 0;
  let pinched = false;

  const measureSpan = (): number => {
    const iter = touches.values();
    const first = iter.next().value;
    const second = iter.next().value;
    if (!first || !second) return 0;
    return Math.hypot(second.x - first.x, second.y - first.y);
  };

  const onPointerDown = (event: PointerEvent): boolean => {
    if (event.pointerType !== "touch") return false;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size >= 2) {
      prevSpan = measureSpan();
      pinched = true;
      return true;
    }
    return false;
  };

  const onPointerMove = (event: PointerEvent): number | null => {
    if (event.pointerType !== "touch") return null;
    const entry = touches.get(event.pointerId);
    if (!entry) return null;
    entry.x = event.clientX;
    entry.y = event.clientY;
    if (touches.size < 2) return pinched ? 0 : null;
    const nextSpan = measureSpan();
    let delta = 0;
    if (prevSpan > MIN_PINCH_SPAN_PX && nextSpan > MIN_PINCH_SPAN_PX) {
      delta = clampStep(Math.log(prevSpan / nextSpan) * PINCH_ZOOM_GAIN, MAX_PINCH_STEP);
    }
    prevSpan = nextSpan;
    return delta;
  };

  const onPointerUp = (event: PointerEvent): boolean => {
    if (event.pointerType !== "touch") return false;
    touches.delete(event.pointerId);
    prevSpan = touches.size >= 2 ? measureSpan() : 0;
    const wasPinching = pinched;
    if (touches.size === 0) pinched = false;
    return wasPinching;
  };

  const reset = (): void => {
    touches.clear();
    prevSpan = 0;
    pinched = false;
  };

  return { onPointerDown, onPointerMove, onPointerUp, reset };
};
