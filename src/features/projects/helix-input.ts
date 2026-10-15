const WHEEL_LINE_PX = 16;
// Contrato compartido con la escena: píxeles de gesto por slot helicoidal
export const PX_PER_SLOT = 140;
const TOUCH_GAIN = 1.4;
const MOMENTUM_WINDOW_MS = 80;
const MOMENTUM_CARRY_MS = 240;
const MOMENTUM_MAX_PX = 3 * PX_PER_SLOT;

type HelixInputTarget = {
  readonly isZoneVisible: () => boolean;
  readonly zoneClientHeight: () => number;
  readonly advanceBy: (deltaPx: number) => void;
  readonly advanceTo: (slots: number) => void;
};

export type HelixInputController = {
  readonly dispose: () => void;
};

export const mountHelixInput = (
  zone: HTMLElement,
  target: HelixInputTarget,
): HelixInputController => {
  const onWheel = (event: WheelEvent) => {
    if (!target.isZoneVisible()) return;
    event.preventDefault();
    const deltaPx =
      event.deltaMode === 1
        ? event.deltaY * WHEEL_LINE_PX
        : event.deltaMode === 2
          ? event.deltaY * target.zoneClientHeight()
          : event.deltaY;
    target.advanceBy(deltaPx);
  };
  window.addEventListener("wheel", onWheel, { passive: false });

  const onKeyDown = (event: KeyboardEvent) => {
    if (!target.isZoneVisible()) return;
    const slots =
      event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowUp"
          ? -1
          : event.key === "PageDown"
            ? 3
            : event.key === "PageUp"
              ? -3
              : null;
    if (slots !== null) {
      event.preventDefault();
      target.advanceBy(slots * PX_PER_SLOT);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      target.advanceTo(0);
    }
  };
  window.addEventListener("keydown", onKeyDown);

  let trackedTouchId: number | null = null;
  let lastTouchY: number | null = null;
  let touchSamples: { time: number; deltaPx: number }[] = [];
  const resetTouchDrag = () => {
    trackedTouchId = null;
    lastTouchY = null;
    touchSamples = [];
  };

  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) {
      resetTouchDrag();
      return;
    }
    const touch = event.touches.item(0);
    if (touch) {
      trackedTouchId = touch.identifier;
      lastTouchY = touch.clientY;
      touchSamples = [];
    }
  };

  const onTouchMove = (event: TouchEvent) => {
    if (!target.isZoneVisible()) return;
    event.preventDefault();
    if (event.touches.length !== 1) {
      resetTouchDrag();
      return;
    }
    const touch = event.touches.item(0);
    if (!touch) return;
    if (touch.identifier !== trackedTouchId || lastTouchY === null) {
      trackedTouchId = touch.identifier;
      lastTouchY = touch.clientY;
      touchSamples = [];
      return;
    }
    const deltaPx = (lastTouchY - touch.clientY) * TOUCH_GAIN;
    target.advanceBy(deltaPx);
    lastTouchY = touch.clientY;
    const now = performance.now();
    touchSamples.push({ time: now, deltaPx });
    touchSamples = touchSamples.filter((sample) => now - sample.time <= MOMENTUM_WINDOW_MS);
  };

  const onTouchEnd = () => {
    const first = touchSamples[0];
    const last = touchSamples[touchSamples.length - 1];
    if (first && last) {
      const elapsed = last.time - first.time;
      if (elapsed > 0) {
        const totalPx = touchSamples.reduce((sum, sample) => sum + sample.deltaPx, 0);
        const momentumPx = (totalPx / elapsed) * MOMENTUM_CARRY_MS;
        target.advanceBy(Math.min(MOMENTUM_MAX_PX, Math.max(-MOMENTUM_MAX_PX, momentumPx)));
      }
    }
    resetTouchDrag();
  };

  zone.addEventListener("touchstart", onTouchStart, { passive: false });
  zone.addEventListener("touchmove", onTouchMove, { passive: false });
  zone.addEventListener("touchend", onTouchEnd);
  zone.addEventListener("touchcancel", onTouchEnd);

  return {
    dispose: () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      zone.removeEventListener("touchstart", onTouchStart);
      zone.removeEventListener("touchmove", onTouchMove);
      zone.removeEventListener("touchend", onTouchEnd);
      zone.removeEventListener("touchcancel", onTouchEnd);
    },
  };
};
