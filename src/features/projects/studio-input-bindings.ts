import type { StudioInputDeps, StudioScreenZone } from "./studio.types";
import { executeNokiaButtonClick, handleNokiaSnakeSwipe } from "./studio-nokia-input";
import type { NokiaButtonId } from "./studio-nokia-keypad";
import {
  createStudioEmailFeedback,
  createStudioPinchZoom,
  createStudioWheelHandler,
  handleStudioShowcaseDblClick,
  normStudioXY,
  STUDIO_IGNORE_SURFACE_SEL,
} from "./studio-pinch-zoom";
import type { StudioFocusPropId, StudioFocusTarget } from "./studio-prop-focus";
import {
  classifyStudioHoverZone,
  executeStudioCanvasClick,
  executeZoomedZoneAction,
  handleStudioKeyDown,
} from "./studio-screen-hit";
import {
  handleTvSpecialClick,
  isTvSpecialZone,
  resolvePortalBezelZone,
} from "./studio-tv-button-action";
import type { TvButtonId } from "./studio-tv-buttons";

const CFG = { drag: 180, tol: 6, touchTol: 12, yaw: 0.0072, pitch: 0.0052 } as const;

export const bindStudioInputs = (deps: StudioInputDeps): (() => void) => {
  const { canvas, scene, physics, autoplay, power, audio, cursor } = deps;
  const surface = canvas.closest<HTMLElement>("[data-projects-section]") ?? canvas;
  const pinch = createStudioPinchZoom();
  const wheel = createStudioWheelHandler(deps);
  const emailFeedback = createStudioEmailFeedback(deps);
  const pt = { sx: 0, sy: 0, maxDist: 0, startSlot: 0 };
  const drag = {
    id: null as number | null,
    tvDrag: false,
    lx: 0,
    ly: 0,
    focusAtDown: null as StudioFocusTarget | null,
    propAtDown: null as StudioFocusPropId | null,
    nokiaBtn: null as NokiaButtonId | null,
    tvBtn: null as TvButtonId | null,
    zone: "none" as StudioScreenZone,
  };
  const releaseDrag = (snapIfTv = false): void => {
    if (drag.id !== null && surface.hasPointerCapture(drag.id)) {
      surface.releasePointerCapture(drag.id);
    }
    drag.id = null;
    if (drag.tvDrag) {
      drag.tvDrag = false;
      deps.setDragging(false);
      physics.endDrag();
      if (snapIfTv) physics.snapToNearestSlot();
    }
    cursor.setPressed(false);
  };
  const onWindowBlur = (): void => {
    pinch.reset();
    releaseDrag(true);
  };
  const onPointerDown = (e: PointerEvent): void => {
    if (e.target instanceof Element && e.target.closest(STUDIO_IGNORE_SURFACE_SEL)) return;
    const focus = deps.getFocusTarget();
    if (focus !== "tv" && pinch.onPointerDown(e)) {
      releaseDrag(true);
      return;
    }
    if ((e.pointerType === "mouse" && e.button !== 0) || drag.id !== null) return;
    const [nx, ny] = normStudioXY(e.clientX, e.clientY);
    const inPortal = focus === "tv" && deps.isTvPortalOpen();
    if (inPortal && scene.pickScreenUv(nx, ny) !== null) return;
    const portalRes = inPortal ? resolvePortalBezelZone(scene.pickTvButton(nx, ny)) : null;
    const zone =
      portalRes?.zone ?? classifyStudioHoverZone(scene, nx, ny, power.isPoweredOn, focus);
    if (focus === "tv" && !isTvSpecialZone(zone)) {
      autoplay.notifyUserInteraction();
      physics.beginDrag();
      deps.setDragging(true);
      drag.tvDrag = true;
    }
    [drag.id, pt.maxDist, pt.startSlot] = [e.pointerId, 0, physics.currentPosition];
    [pt.sx, drag.lx, pt.sy, drag.ly] = [e.clientX, e.clientX, e.clientY, e.clientY];
    [drag.focusAtDown, drag.zone] = [focus, zone];
    drag.propAtDown = focus !== "tv" ? scene.pickFocusProp(nx, ny) : null;
    drag.nokiaBtn = focus === "phone" ? scene.pickNokiaButton(nx, ny) : null;
    const pickBtn = zone === "tv_button" || zone === "power" ? scene.pickTvButton(nx, ny) : null;
    drag.tvBtn = portalRes?.tvBtn ?? pickBtn;
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
    const [nx, ny] = normStudioXY(e.clientX, e.clientY);
    if (e.pointerId !== drag.id) {
      deps.updatePointerHover(nx, ny);
      return;
    }
    const [dx, dy] = [e.clientX - drag.lx, e.clientY - drag.ly];
    [drag.lx, drag.ly] = [e.clientX, e.clientY];
    pt.maxDist = Math.max(pt.maxDist, Math.hypot(e.clientX - pt.sx, e.clientY - pt.sy));
    const tol = e.pointerType === "mouse" ? CFG.tol : CFG.touchTol;
    if (drag.focusAtDown !== "tv") {
      if (
        drag.focusAtDown === "phone" &&
        e.pointerType !== "mouse" &&
        scene.getNokiaMode() === "snake"
      ) {
        if (handleNokiaSnakeSwipe(scene, e.clientX, e.clientY, pt, !audio.isMuted()))
          deps.requestFrame();
        return;
      }
      if (pt.maxDist >= tol) {
        scene.addOrbitDelta(-dx * CFG.yaw, dy * CFG.pitch);
        deps.updatePointerHover(nx, ny, true);
      }
      return;
    }
    if (drag.zone !== "bezel_exit") {
      physics.setDirectPosition(pt.startSlot - (e.clientY - pt.sy) / CFG.drag);
      deps.updatePointerHover(nx, ny, pt.maxDist >= tol);
    }
  };
  const onStepSlot = (step: -1 | 1): void => {
    autoplay.notifyUserInteraction(step);
    physics.stepSlots(step);
    deps.requestFrame();
  };
  const onPointerUp = (e: PointerEvent): void => {
    const wasPinch = pinch.onPointerUp(e);
    if (e.pointerId !== drag.id) return;
    const tol = e.pointerType === "mouse" ? CFG.tol : CFG.touchTol;
    const isClick = !wasPinch && pt.maxDist < tol && e.type === "pointerup";
    const { zone, focusAtDown, propAtDown, nokiaBtn, tvBtn } = drag;
    releaseDrag(false);
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
    if (physics.scrollVelocity !== 0) autoplay.setDirection(physics.scrollVelocity > 0 ? 1 : -1);
    if (isClick && Math.abs(physics.targetPosition - physics.currentPosition) < 0.25) {
      executeZoomedZoneAction(zone, {
        activeIndex: deps.getActiveIndex(),
        audio,
        onOpenInTv: deps.openInTv,
        onStepSlot,
        onEmailCopied: emailFeedback.notifyCopied,
        onSoundToggled: deps.refreshHud,
      });
    } else physics.snapToNearestSlot();
    deps.refreshHud();
  };
  const onVis = (): void => {
    if (document.visibilityState === "visible") deps.requestFrame();
  };
  const listeners: readonly [EventTarget, string, EventListener, AddEventListenerOptions?][] = [
    [window, "pointermove", onPointerMove as EventListener, { passive: true }],
    [window, "wheel", wheel.onWheel as EventListener, { passive: false }],
    [window, "keydown", ((ev: KeyboardEvent) => handleStudioKeyDown(ev, deps)) as EventListener],
    [surface, "pointerdown", onPointerDown as EventListener],
    [window, "pointerup", onPointerUp as EventListener],
    [window, "pointercancel", onPointerUp as EventListener],
    [window, "blur", onWindowBlur],
    [
      surface,
      "dblclick",
      ((ev: MouseEvent) => handleStudioShowcaseDblClick(ev, deps)) as EventListener,
    ],
    [document, "pointerleave", deps.onPointerLeave as EventListener],
    [document, "visibilitychange", onVis],
    [document, "consent:completed", () => queueMicrotask(deps.refreshHud)],
  ];
  for (const [t, evt, fn, opts] of listeners) t.addEventListener(evt, fn, opts);
  return () => {
    onWindowBlur();
    wheel.dispose();
    emailFeedback.dispose();
    for (const [t, evt, fn] of listeners) t.removeEventListener(evt, fn);
  };
};
