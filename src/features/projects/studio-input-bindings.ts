import type { StudioInputDeps, StudioScreenZone } from "./studio.types";
import { executeNokiaButtonClick, handleNokiaSnakeSwipe } from "./studio-nokia-input";
import type { NokiaButtonId } from "./studio-nokia-keypad";
import { createStudioPinchZoom, createStudioWheelHandler } from "./studio-pinch-zoom";
import type { StudioFocusPropId, StudioFocusTarget } from "./studio-prop-focus";
import {
  classifyStudioHoverZone,
  executeStudioCanvasClick,
  executeZoomedZoneAction,
  handleStudioKeyDown,
} from "./studio-screen-hit";
import { handleTvSpecialClick, isTvSpecialZone } from "./studio-tv-button-action";
import type { TvButtonId } from "./studio-tv-buttons";

const CFG = { drag: 180, tol: 6, yaw: 0.0072, pitch: 0.0052 } as const;
const IGNORE_SURFACE_SEL = "[data-studio-tv-portal], [data-studio-sound-toggle]";
const normXY = (x: number, y: number) => ({
  nx: (x / Math.max(1, innerWidth)) * 2 - 1,
  ny: -((y / Math.max(1, innerHeight)) * 2 - 1),
});

export const bindStudioInputs = (deps: StudioInputDeps): (() => void) => {
  const { canvas, scene, physics, autoplay, power, audio, cursor } = deps;
  const surface = canvas.closest<HTMLElement>("[data-projects-section]") ?? canvas;
  const pinch = createStudioPinchZoom();
  const wheel = createStudioWheelHandler(deps);
  let emailResetTimer: number | null = null;
  const drag = {
    id: null as number | null,
    sx: 0,
    sy: 0,
    lx: 0,
    ly: 0,
    maxDist: 0,
    startSlot: 0,
    focusAtDown: null as StudioFocusTarget | null,
    propAtDown: null as StudioFocusPropId | null,
    nokiaBtn: null as NokiaButtonId | null,
    tvBtn: null as TvButtonId | null,
    zone: "none" as StudioScreenZone,
  };
  const releaseDrag = (): void => {
    if (drag.id !== null && surface.hasPointerCapture(drag.id))
      surface.releasePointerCapture(drag.id);
    drag.id = null;
    cursor.setPressed(false);
  };
  const onKeyDown = (event: KeyboardEvent): void => handleStudioKeyDown(event, deps);
  const onPointerDown = (e: PointerEvent): void => {
    if (e.target instanceof Element && e.target.closest(IGNORE_SURFACE_SEL)) return;
    const focus = deps.getFocusTarget();
    if (focus !== "tv" && pinch.onPointerDown(e)) {
      releaseDrag();
      return;
    }
    if ((e.pointerType === "mouse" && e.button !== 0) || drag.id !== null) return;
    const { nx, ny } = normXY(e.clientX, e.clientY);
    if (focus === "tv" && deps.isTvPortalOpen() && scene.pickScreenUv(nx, ny) !== null) return;
    const zone =
      focus === "tv" && deps.isTvPortalOpen()
        ? "bezel_exit"
        : classifyStudioHoverZone(scene, nx, ny, power.isPoweredOn, focus);
    if (focus === "tv" && !isTvSpecialZone(zone)) {
      autoplay.notifyUserInteraction();
      physics.beginDrag();
      deps.setDragging(true);
    }
    drag.id = e.pointerId;
    drag.sx = drag.lx = e.clientX;
    drag.sy = drag.ly = e.clientY;
    drag.maxDist = 0;
    drag.startSlot = physics.currentPosition;
    drag.focusAtDown = focus;
    drag.propAtDown = focus !== "tv" ? scene.pickFocusProp(nx, ny) : null;
    drag.nokiaBtn = focus === "phone" ? scene.pickNokiaButton(nx, ny) : null;
    drag.tvBtn = zone === "tv_button" || zone === "power" ? scene.pickTvButton(nx, ny) : null;
    drag.zone = zone;
    try {
      surface.setPointerCapture(e.pointerId);
    } catch (err: unknown) {
      if (!(err instanceof DOMException)) console.warn("[StudioInput] Capture failed:", err);
    }
    cursor.setPressed(true);
  };
  const onPointerMove = (e: PointerEvent): void => {
    const pinchDelta = pinch.onPointerMove(e);
    if (pinchDelta !== null) {
      if (deps.getFocusTarget() !== "tv" && pinchDelta !== 0) {
        scene.addDistanceScaleDelta(pinchDelta);
        deps.requestFrame();
      }
      return;
    }
    const { nx, ny } = normXY(e.clientX, e.clientY);
    if (e.pointerId !== drag.id) {
      deps.updatePointerHover(nx, ny);
      return;
    }
    const [dx, dy] = [e.clientX - drag.lx, e.clientY - drag.ly];
    [drag.lx, drag.ly] = [e.clientX, e.clientY];
    drag.maxDist = Math.max(drag.maxDist, Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy));
    if (drag.focusAtDown !== "tv") {
      const snakeTouch =
        drag.focusAtDown === "phone" &&
        e.pointerType !== "mouse" &&
        scene.getNokiaMode() === "snake";
      if (snakeTouch) {
        if (handleNokiaSnakeSwipe(scene, e.clientX, e.clientY, drag, !audio.isMuted()))
          deps.requestFrame();
        return;
      }
      if (drag.maxDist >= CFG.tol) {
        scene.addOrbitDelta(-dx * CFG.yaw, dy * CFG.pitch);
        deps.updatePointerHover(nx, ny, true);
      }
      return;
    }
    if (drag.zone !== "bezel_exit") {
      physics.setDirectPosition(drag.startSlot - (e.clientY - drag.sy) / CFG.drag);
      deps.updatePointerHover(nx, ny, drag.maxDist >= CFG.tol);
    }
  };
  const onDoubleClick = (e: MouseEvent): void => {
    if (e.target instanceof Element && e.target.closest(IGNORE_SURFACE_SEL)) return;
    if (deps.getFocusTarget() !== null) return;
    const { nx, ny } = normXY(e.clientX, e.clientY);
    const zone = classifyStudioHoverZone(scene, nx, ny, power.isPoweredOn, null);
    if (zone === "power" || zone === "tv_button" || zone === "prop_zoom" || zone === "chair_sit") {
      return;
    }
    scene.cycleShowcaseAngle();
    cursor.pulse();
    deps.requestFrame();
  };
  const onEmailCopied = (): void => {
    scene.setEmailCopied(true);
    if (emailResetTimer !== null) window.clearTimeout(emailResetTimer);
    emailResetTimer = window.setTimeout(() => {
      emailResetTimer = null;
      scene.setEmailCopied(false);
      deps.requestFrame();
    }, 2000);
    deps.requestFrame();
  };
  const onPointerUp = (e: PointerEvent): void => {
    const wasPinch = pinch.onPointerUp(e);
    if (e.pointerId !== drag.id) return;
    const isClick = !wasPinch && drag.maxDist < CFG.tol && e.type === "pointerup";
    const { zone, focusAtDown, propAtDown, nokiaBtn, tvBtn } = drag;
    releaseDrag();
    if (focusAtDown !== "tv") {
      if (isClick && focusAtDown === "phone" && nokiaBtn) {
        executeNokiaButtonClick(scene, nokiaBtn, !audio.isMuted());
        cursor.pulse();
        deps.refreshHud();
        return;
      }
      if (!(isClick && executeStudioCanvasClick(zone, propAtDown, deps, tvBtn))) deps.refreshHud();
      return;
    }
    if (handleTvSpecialClick(zone, tvBtn, isClick, deps)) return;
    deps.setDragging(false);
    physics.endDrag();
    if (physics.scrollVelocity !== 0) autoplay.setDirection(physics.scrollVelocity > 0 ? 1 : -1);
    if (isClick && Math.abs(physics.targetPosition - physics.currentPosition) < 0.25) {
      executeZoomedZoneAction(zone, {
        activeIndex: deps.getActiveIndex(),
        audio,
        onOpenInTv: deps.openInTv,
        onStepSlot: (step) => {
          autoplay.notifyUserInteraction(step);
          physics.stepSlots(step);
          deps.requestFrame();
        },
        onEmailCopied,
        onSoundToggled: deps.refreshHud,
      });
    } else physics.snapToNearestSlot();
    deps.refreshHud();
  };
  const listeners: readonly [EventTarget, string, EventListener, AddEventListenerOptions?][] = [
    [window, "pointermove", onPointerMove as EventListener, { passive: true }],
    [window, "wheel", wheel.onWheel as EventListener, { passive: false }],
    [window, "keydown", onKeyDown as EventListener],
    [surface, "pointerdown", onPointerDown as EventListener],
    [window, "pointerup", onPointerUp as EventListener],
    [window, "pointercancel", onPointerUp as EventListener],
    [surface, "dblclick", onDoubleClick as EventListener],
    [document, "pointerleave", deps.onPointerLeave as EventListener],
    [document, "consent:completed", () => queueMicrotask(deps.refreshHud)],
  ];
  for (const [t, evt, fn, opts] of listeners) t.addEventListener(evt, fn, opts);
  return () => {
    pinch.reset();
    wheel.dispose();
    if (emailResetTimer !== null) window.clearTimeout(emailResetTimer);
    for (const [t, evt, fn] of listeners) t.removeEventListener(evt, fn);
  };
};
