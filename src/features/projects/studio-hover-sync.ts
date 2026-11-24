import type { AudioEngineContract } from "../../core/audio.types";
import type { CursorController } from "../../design-system/components/cursor.types";
import { consumeDetentStep } from "./drum.types";
import type { DrumAutoplayController } from "./drum-autoplay";
import type { DrumScrollPhysics } from "./drum-scroll-physics";
import { DRUM_SLOTS, PROJECT_COUNT } from "./project-data";
import type { StudioSceneHandle, StudioScreenZone } from "./studio.types";
import type { StudioA11yHandle } from "./studio-a11y";
import type { StudioEntryHintHandle } from "./studio-entry-hint";
import type { StudioPowerController } from "./studio-power-state";
import type { StudioFocusTarget } from "./studio-prop-focus";
import {
  applyZoneCursorState,
  classifyStudioHoverZone,
  isDarkProjectCard,
  resolveHoveredFocusTarget,
} from "./studio-screen-hit";
import type { TvButtonId } from "./studio-tv-buttons";
import type { StudioTvPortalHandle } from "./studio-tv-portal";

const SLOT_ANGLE = (2 * Math.PI) / DRUM_SLOTS;
const INTRO_SETTLE_RATE = 2.6;

export const toStudioSlotIndex = (pos: number): number =>
  ((Math.round(pos) % PROJECT_COUNT) + PROJECT_COUNT) % PROJECT_COUNT;

export interface StudioControllerState {
  raf: number | null;
  lastTime: number;
  lastHoverMs: number;
  wasIntro: boolean;
  intro: number;
  dragging: boolean;
  x: number;
  y: number;
  focus: StudioFocusTarget | null;
  chairBreathPlayed: boolean;
  tvBtn: TvButtonId | null;
  zone: StudioScreenZone;
}

export const createInitialStudioState = (): StudioControllerState => ({
  raf: null,
  lastTime: 0,
  lastHoverMs: 0,
  wasIntro: false,
  intro: 1,
  dragging: false,
  x: 0,
  y: 0,
  focus: null,
  chairBreathPlayed: false,
  tvBtn: null,
  zone: "none",
});

export interface StudioTickDeps {
  readonly st: StudioControllerState;
  readonly tickState: { prevPos: number; lastDetentPos: number };
  readonly scene: StudioSceneHandle;
  readonly physics: DrumScrollPhysics;
  readonly autoplay: DrumAutoplayController;
  readonly power: StudioPowerController;
  readonly audio: AudioEngineContract;
  readonly tvPortal: StudioTvPortalHandle;
  readonly entryHint: StudioEntryHintHandle;
  readonly syncHover: () => void;
}

export const clearStudioHoverState = (
  scene: StudioSceneHandle,
  cursor: CursorController,
): StudioScreenZone => {
  scene.setHoveredHotspot(null);
  scene.setHoveredTvButton(null);
  cursor.setMuted(false);
  cursor.setExpanded(false);
  return "none";
};

export const syncStudioHoverState = (
  scene: StudioSceneHandle,
  cursor: CursorController,
  power: StudioPowerController,
  audio: AudioEngineContract,
  st: StudioControllerState,
  hasPortal: boolean,
  activeIndex: number,
  reset: boolean,
): StudioScreenZone => {
  const { x: nx, y: ny, focus } = st;
  const inPortal = focus === "tv" && hasPortal && scene.pickScreenUv(nx, ny) !== null;
  const portalBezelBtn =
    focus === "tv" && hasPortal && !inPortal ? scene.pickTvButton(nx, ny) : null;
  const zone: StudioScreenZone = inPortal
    ? "none"
    : portalBezelBtn
      ? portalBezelBtn === "power"
        ? "power"
        : "tv_button"
      : focus === "tv" && hasPortal
        ? "bezel_exit"
        : classifyStudioHoverZone(scene, nx, ny, power.isPoweredOn, focus);
  const tvBtn =
    portalBezelBtn ??
    (zone === "tv_button" || zone === "power" ? scene.pickTvButton(nx, ny) : null);
  const hoveredHotspot = resolveHoveredFocusTarget(scene, zone, nx, ny);
  scene.setHoveredHotspot(hoveredHotspot);
  scene.setHoveredTvButton(tvBtn);
  if (reset || zone !== st.zone || tvBtn !== st.tvBtn) {
    if (!reset && !inPortal && !st.dragging) {
      if (tvBtn && tvBtn !== st.tvBtn) audio.playTactileFeedback("hover_button");
      else if (zone !== st.zone && hoveredHotspot !== null) {
        audio.playTactileFeedback("hover_hotspot");
      }
    }
    st.tvBtn = tvBtn;
    if (!inPortal) {
      applyZoneCursorState(cursor, zone, power.getCursorLabel(), audio.isMuted(), tvBtn);
    }
  }
  if (!inPortal) {
    const onWhiteTvScreen =
      focus === "tv" &&
      !hasPortal &&
      power.isPoweredOn &&
      scene.getTvChannel() === "portfolio" &&
      zone !== "bezel_exit" &&
      zone !== "tv_button" &&
      zone !== "power" &&
      !(zone === "card" && isDarkProjectCard(activeIndex));
    cursor.setInverted(!onWhiteTvScreen);
  }
  return zone;
};

export const syncStudioDrumScene = (
  scene: StudioSceneHandle,
  physics: DrumScrollPhysics,
  audio: AudioEngineContract,
  intro: number,
): void => {
  const { currentPosition: p, scrollVelocity: v } = physics;
  scene.setDrumState(p * SLOT_ANGLE, v, intro, toStudioSlotIndex(p), !audio.isMuted());
};

export const stepStudioFrame = (
  deps: StudioTickDeps,
  now: number,
  a11y: StudioA11yHandle,
): boolean => {
  const { st, tickState, scene: sc, physics: ph, autoplay: ap, power: pw, audio, tvPortal } = deps;
  const dt = Math.min((now - st.lastTime) / 1000, 0.05);
  st.lastTime = now;
  const [moved, powAnim] = [sc.update(dt), pw.update(dt)];
  sc.setPowerState(pw.powerProgress, pw.buttonDepression);
  const hasPage = tvPortal.hasActivePage();
  if (st.focus === "tv" && hasPage && pw.isPoweredOn && sc.isFocusSettled()) tvPortal.resume();
  if (st.focus === "chair" && !st.chairBreathPlayed && sc.isFocusSettled()) {
    st.chairBreathPlayed = true;
    audio.triggerChairBreath("play");
  }
  const portalUrl = tvPortal.getActiveUrl();
  const pv = tvPortal.stepVisuals(dt, pw.isPoweredOn);
  sc.setTvPortalState(pv.mode, pv.cutout, pv.wave, portalUrl?.startsWith("/sobre-mi") ?? false);
  const inIntro = sc.isIntroActive();
  if (moved || powAnim) {
    if (tvPortal.isInteractive()) tvPortal.syncBounds(sc.camera);
    else if (!st.dragging && !inIntro && now - st.lastHoverMs >= 33) {
      st.lastHoverMs = now;
      deps.syncHover();
    }
  }
  if (pw.isPoweredOn || st.focus !== null) deps.entryHint.dismiss();
  if (st.wasIntro && !inIntro) {
    st.lastHoverMs = now;
    deps.entryHint.reveal();
    deps.syncHover();
  }
  st.wasIntro = inIntro;
  if (st.intro < 1) {
    const next = 1 - (1 - st.intro) * Math.exp(-INTRO_SETTLE_RATE * dt);
    st.intro = next > 0.998 ? 1 : next;
  }
  const canDrift = pw.powerProgress >= 0.01 && !hasPage;
  const drift = canDrift ? ap.update(dt, st.focus === "tv" && st.zone === "card") : 0;
  if (drift !== 0) ph.addContinuousDrift(drift);
  const idle = ph.update(dt) && !st.dragging && (!canDrift || !ap.isDrifting());
  if (canDrift && consumeDetentStep(ph.currentPosition, tickState) && ap.isUserInteracting()) {
    audio.playTactileFeedback("wheel_tick", ph.scrollVelocity);
  }
  syncStudioDrumScene(sc, ph, audio, st.intro);
  const slotIdx = toStudioSlotIndex(ph.currentPosition);
  a11y.sync(st.focus, pw.isPoweredOn, sc.getTvChannel(), slotIdx, portalUrl);
  sc.render();
  return moved || !idle || powAnim || pv.animating || st.intro < 1 || sc.isSkyAnimated();
};
