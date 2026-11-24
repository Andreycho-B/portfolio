import type { PerspectiveCamera } from "three";
import { registerStudioTvBridge } from "../../core/tv-portal-bridge";
import {
  createCrtPortalAperture,
  createCrtPortalDom,
  isRootPortalRoute,
  readPortalFrameHref,
  replacePortalFrameUrl,
  resetPortalCursor,
  stepPortalVisualState,
  syncPortalDomVisibility,
} from "./studio-crt-aperture";
import { createStudioCrtFluidWipe } from "./studio-crt-fluid-wipe";
import type { StudioTvPortalDeps, StudioTvPortalHandle } from "./studio-tv-portal.types";

export type { StudioTvPortalDeps, StudioTvPortalHandle } from "./studio-tv-portal.types";

const FRAME_SETTLE_MS = 85;
const LOAD_FALLBACK_MS = 1100;
const prefersReduced = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const createStudioTvPortal = (deps: StudioTvPortalDeps): StudioTvPortalHandle => {
  const { portalEl, iframeEl } = createCrtPortalDom(deps.container);
  const aperture = createCrtPortalAperture();
  const wipe = createStudioCrtFluidWipe(() => deps.onPortalChange(false));
  const s = {
    url: null as string | null,
    displayMode: 0 as 0 | 1,
    live: false,
    tuning: false,
    closing: false,
    frameReady: false,
    cutout: 0,
  };
  let tuneTimer: number | null = null;
  const clearTune = (): void => {
    if (tuneTimer !== null) window.clearTimeout(tuneTimer);
    tuneTimer = null;
  };
  const setDom = (has: boolean, live: boolean, tuning = false): void =>
    syncPortalDomVisibility(deps.container, portalEl, has, live, tuning);
  const syncBounds = (camera: PerspectiveCamera): void => aperture.sync(portalEl, camera);
  const commitCloseToDrum = (sweepOut = true): void => {
    clearTune();
    Object.assign(s, { url: null, displayMode: 0, live: false, tuning: false, closing: false });
    [s.frameReady, s.cutout] = [false, 0];
    setDom(false, false);
    resetPortalCursor(deps.cursor);
    replacePortalFrameUrl(iframeEl, "about:blank");
    const vp = deps.container.querySelector<HTMLElement>("[data-drum-viewport]");
    requestAnimationFrame(() => vp?.focus({ preventScroll: true }));
    deps.onPortalChange(!sweepOut);
    if (sweepOut) wipe.startSweepOut();
    else wipe.cancel();
  };
  const tryRevealTarget = (): void => {
    if (!s.url || s.closing || !s.frameReady || !wipe.isCovering()) return;
    if (isRootPortalRoute(readPortalFrameHref(iframeEl))) {
      commitCloseToDrum(true);
      return;
    }
    deps.captureSnapshot(iframeEl);
    const live = deps.isTvFocused();
    Object.assign(s, { displayMode: 1, tuning: false, live, cutout: live ? 1 : 0 });
    setDom(true, live);
    if (live) syncBounds(deps.camera);
    else {
      tuneTimer = window.setTimeout(() => {
        tuneTimer = null;
        if (!s.url || s.live || s.tuning || s.closing) return;
        deps.captureSnapshot(iframeEl);
        deps.onPortalChange(false);
      }, 650);
    }
    deps.onPortalChange(false);
    wipe.startSweepOut();
  };
  const closeToDrum = (): void => {
    if (s.url === null || s.closing) return;
    clearTune();
    const keepLive = s.live && !s.tuning;
    if (!keepLive && !s.tuning) deps.captureSnapshot(iframeEl);
    Object.assign(s, { displayMode: 1, live: keepLive, tuning: true, closing: true });
    [s.frameReady, s.cutout] = [false, keepLive ? s.cutout : 0];
    setDom(true, keepLive, true);
    resetPortalCursor(deps.cursor);
    deps.audio.playTactileFeedback("tick", 0.55);
    deps.onPortalChange(!keepLive);
    wipe.startSweepIn(() => commitCloseToDrum(true));
  };
  const markReady = (): void => {
    s.frameReady = true;
    tryRevealTarget();
  };
  const onFrameLoad = (): void => {
    if (!s.url || !s.tuning || s.closing) return;
    const href = readPortalFrameHref(iframeEl);
    if (href === "about:blank") return;
    if (isRootPortalRoute(href)) commitCloseToDrum(true);
    else {
      clearTune();
      if (prefersReduced()) markReady();
      else tuneTimer = window.setTimeout(markReady, FRAME_SETTLE_MS);
    }
  };
  const startFrameNav = (targetUrl: string): void => {
    replacePortalFrameUrl(iframeEl, targetUrl);
    tuneTimer = window.setTimeout(markReady, LOAD_FALLBACK_MS);
  };
  const open = (targetUrl: string): void => {
    if (isRootPortalRoute(targetUrl)) {
      closeToDrum();
      return;
    }
    clearTune();
    const wasPortal = s.url !== null;
    const keepLive = wasPortal && s.live && !s.tuning;
    if (!keepLive && wasPortal && !s.tuning) deps.captureSnapshot(iframeEl);
    Object.assign(s, { url: targetUrl, displayMode: wasPortal ? 1 : 0, live: keepLive });
    [s.tuning, s.closing, s.frameReady, s.cutout] = [true, false, false, keepLive ? s.cutout : 0];
    setDom(true, keepLive, true);
    syncBounds(deps.camera);
    resetPortalCursor(deps.cursor, true);
    deps.audio.playTactileFeedback("click", 0.85);
    deps.onPortalChange(wasPortal && !keepLive);
    if (!keepLive) {
      startFrameNav(targetUrl);
      wipe.startSweepIn(tryRevealTarget);
      return;
    }
    wipe.startSweepIn(() => {
      if (s.url !== targetUrl || s.closing) return;
      Object.assign(s, { live: false, cutout: 0 });
      setDom(true, false, true);
      deps.onPortalChange(false);
      startFrameNav(targetUrl);
    });
  };
  const suspend = (): void => {
    if (!s.url) return;
    if (s.closing) commitCloseToDrum(false);
    else {
      if (!s.tuning || s.live) {
        iframeEl.contentWindow?.dispatchEvent(new Event("studio-tv:reset-pose"));
        deps.captureSnapshot(iframeEl);
      }
      Object.assign(s, { live: false, cutout: 0 });
      setDom(true, false, s.tuning);
      deps.onPortalChange(true);
    }
  };
  const resume = (): void => {
    if (!s.url || s.live || s.tuning || s.closing) return;
    syncBounds(deps.camera);
    Object.assign(s, { displayMode: 1, live: true });
    setDom(true, true);
    resetPortalCursor(deps.cursor, true);
    deps.onPortalChange(false);
  };
  const onPortalEnter = (): void => {
    if (s.live) deps.onPointerEnter?.();
  };
  iframeEl.addEventListener("load", onFrameLoad);
  portalEl.addEventListener("pointerenter", onPortalEnter);
  registerStudioTvBridge({
    audio: deps.audio,
    cursor: deps.cursor,
    closeToDrum,
    exitTvFocus: deps.onExitTvFocus,
    navigateInTv: open,
    handleChannelKey: deps.onChannelKey,
    syncPointer: (x, y) =>
      deps.onPointerMove?.(
        (x / Math.max(1, innerWidth)) * 2 - 1,
        -((y / Math.max(1, innerHeight)) * 2 - 1),
      ),
  });
  return {
    open,
    suspend,
    resume,
    closeToDrum,
    syncBounds,
    stepVisuals: (dt, poweredOn) =>
      stepPortalVisualState(s, dt, poweredOn, prefersReduced(), wipe.getWave(), wipe.isActive()),
    hasActivePage: () => s.url !== null,
    getActiveUrl: () => s.url,
    isInteractive: () => s.live,
    isTuning: () => s.tuning,
    dispose: () => {
      wipe.dispose();
      clearTune();
      deps.container.classList.remove("has-live-portal");
      portalEl.removeEventListener("pointerenter", onPortalEnter);
      iframeEl.removeEventListener("load", onFrameLoad);
      registerStudioTvBridge(null);
      portalEl.remove();
    },
  };
};
