import type { AudioEngineContract } from "../../core/audio.types";
import { PROFILE } from "../../core/profile";
import type { CursorController } from "../../design-system/components/cursor-controller";
import { PROJECT_COUNT, PROJECTS } from "./project-data";
import type { StudioInputDeps, StudioSceneHandle, StudioScreenZone } from "./studio.types";
import { tryStepStudioFocusKey } from "./studio-a11y";
import type { StudioHotspotId } from "./studio-hotspots-shader";
import { classifyNokiaHoverZone } from "./studio-nokia-input";
import type { StudioFocusTarget } from "./studio-prop-focus";
import {
  executeTvButtonAction,
  handleTvShortcutKey,
  TV_BUTTON_LABELS,
} from "./studio-tv-button-action";
import type { TvButtonId } from "./studio-tv-buttons";

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export interface ZoomedActionContext {
  readonly activeIndex: number;
  readonly audio: AudioEngineContract;
  readonly onOpenInTv: (targetUrl: string) => void;
  readonly onStepSlot: (step: -1 | 1) => void;
  readonly onEmailCopied: () => void;
  readonly onSoundToggled: () => void;
}

const toEditorialPixels = (u: number, v: number): readonly [number, number] => {
  const [sx, sy] = [u * 2 - 1, v * 2 - 1];
  const sc = 0.972 + 0.026 * (sx * sx + sy * sy);
  return [clamp01(sx * sc * 0.5 + 0.5) * 1600, (1 - clamp01(sy * sc * 0.5 + 0.5)) * 1120];
};

export const classifyStudioHoverZone = (
  scene: StudioSceneHandle,
  nx: number,
  ny: number,
  isPoweredOn: boolean,
  focusTarget: StudioFocusTarget | null,
): StudioScreenZone => {
  if (Math.abs(nx) > 1.05 || Math.abs(ny) > 1.05) return "none";
  const tvBtn = focusTarget === null || focusTarget === "chair" ? scene.pickTvButton(nx, ny) : null;
  if (tvBtn) return tvBtn === "power" ? "power" : "tv_button";
  if (focusTarget === null) {
    if (scene.isPointerOverPowerButton(nx, ny)) return "power";
    if (scene.pickScreenUv(nx, ny) !== null) return isPoweredOn ? "screen_zoom" : "power";
    const hit = scene.pickFocusProp(nx, ny);
    return hit === null ? "none" : hit === "chair" ? "chair_sit" : "prop_zoom";
  }
  if (focusTarget !== "tv") {
    const nZone = focusTarget === "phone" ? classifyNokiaHoverZone(scene, nx, ny) : null;
    if (nZone !== null) return nZone;
    if (focusTarget === "chair" && scene.isPointerOverPowerButton(nx, ny)) return "power";
    const hit = scene.pickFocusProp(nx, ny);
    if (hit) return hit === focusTarget ? "none" : hit === "chair" ? "chair_sit" : "prop_zoom";
    if (scene.pickScreenUv(nx, ny) !== null && (isPoweredOn || focusTarget === "chair"))
      return isPoweredOn ? "screen_zoom" : "power";
    return focusTarget === "chair" ? "chair_exit" : "prop_exit";
  }
  const uv = scene.pickScreenUv(nx, ny);
  if (!uv) {
    const bezelBtn = scene.pickTvButton(nx, ny);
    return bezelBtn ? (bezelBtn === "power" ? "power" : "tv_button") : "bezel_exit";
  }
  if (scene.getTvChannel() !== "portfolio") return "tv_channel_exit";
  const [px, py] = toEditorialPixels(uv.x, uv.y);
  if (px >= 1280 && py >= 60 && py <= 160) return "sound";
  if (px <= 350 && py >= 968) return "phone";
  if (px >= 1170 && py >= 968) return "email";
  if (px >= 1235 && py >= 500 && py <= 620) return "about";
  if (px >= 368 && px <= 1232 && py >= 316 && py <= 804) return "card";
  return uv.y >= 0.5 ? "step_prev" : "step_next";
};

export const resolveHoveredFocusTarget = (
  scene: StudioSceneHandle,
  zone: StudioScreenZone,
  nx: number,
  ny: number,
): StudioHotspotId | null => {
  if (zone === "power") return "tv_power";
  if (zone === "screen_zoom") return "tv";
  return zone === "prop_zoom" || zone === "chair_sit" ? scene.pickFocusProp(nx, ny) : null;
};
const ZONE_LABELS: Partial<Record<StudioScreenZone, string>> = {
  screen_zoom: "Acercar",
  prop_zoom: "Acercar",
  chair_sit: "Sentarse",
  chair_exit: "Levantarse",
  card: "Ver",
  about: "Sobre mí",
  phone: "WhatsApp",
  email: "Copiar",
  bezel_exit: "Alejar",
  prop_exit: "Alejar",
  tv_channel_exit: "Portafolio",
  nokia_snake: "Snake",
  nokia_back: "Volver",
  nokia_key: "Pulsar",
};
export const applyZoneCursorState = (
  cursor: CursorController,
  zone: StudioScreenZone,
  powerLabel: string,
  isAudioMuted: boolean,
  tvBtn: TvButtonId | null = null,
): void => {
  if (zone === "sound" || (zone === "tv_button" && tvBtn === "mute")) {
    cursor.setMuted(!isAudioMuted);
    cursor.setExpanded(isAudioMuted, isAudioMuted ? "Activar" : undefined);
    return;
  }
  cursor.setMuted(false);
  const tvLabel = zone === "tv_button" && tvBtn ? TV_BUTTON_LABELS[tvBtn] : ZONE_LABELS[zone];
  const label = zone === "power" ? powerLabel : tvLabel;
  cursor.setExpanded(Boolean(label), label);
};
export const openActiveProject = (idx: number, onOpenInTv: (url: string) => void): void => {
  const project = PROJECTS[idx];
  if (project) onOpenInTv(`/proyectos/${project.slug}`);
};
export const executeZoomedZoneAction = (zone: StudioScreenZone, ctx: ZoomedActionContext): void => {
  if (zone === "card") openActiveProject(ctx.activeIndex, ctx.onOpenInTv);
  else if (zone === "about") ctx.onOpenInTv("/sobre-mi");
  else if (zone === "phone") {
    ctx.audio.playTactileFeedback("click");
    window.open(PROFILE.whatsappUrl, "_blank", "noopener,noreferrer");
  } else if (zone === "email" && typeof navigator !== "undefined" && navigator.clipboard) {
    ctx.audio.playTactileFeedback("click");
    void navigator.clipboard
      .writeText(PROFILE.email)
      .then(ctx.onEmailCopied)
      .catch((err: unknown) => console.warn("[StudioScreenHit] Clipboard failed:", err));
  } else if (zone === "sound") {
    ctx.audio.toggleMute();
    ctx.audio.playTactileFeedback("click");
    ctx.onSoundToggled();
  } else if (zone === "step_prev" || zone === "step_next") {
    ctx.onStepSlot(zone === "step_prev" ? -1 : 1);
  }
};
export const isDarkProjectCard = (idx: number): boolean => PROJECTS[idx]?.theme === "dark";
export const executeStudioCanvasClick = (
  zone: StudioScreenZone,
  prop: StudioFocusTarget | null,
  deps: StudioInputDeps,
  tvBtn: TvButtonId | null = null,
): boolean => {
  if (zone === "power" || zone === "tv_button") {
    executeTvButtonAction(tvBtn ?? "power", deps, deps.closeTvPortal);
    return false;
  }
  const isProp = zone === "prop_zoom" || zone === "chair_sit";
  const next = zone === "screen_zoom" ? "tv" : isProp ? prop : null;
  if (next === null && zone !== "prop_exit" && zone !== "chair_exit") return false;
  deps.audio.playTactileFeedback(zone === "screen_zoom" ? "crt_glass_tap" : "click");
  deps.cursor.pulse();
  deps.setFocusTarget(next);
  return true;
};
const dispatchStudioKey = (event: KeyboardEvent, deps: StudioInputDeps): boolean => {
  const focus = deps.getFocusTarget();
  const inSnake = focus === "phone" && deps.scene.getNokiaMode() === "snake";
  if (tryStepStudioFocusKey(event, focus, deps.setFocusTarget, deps.isTvPortalOpen() || inSnake))
    return true;
  if (focus === null) return false;
  if (event.key === "Escape") {
    event.preventDefault();
    if (focus === "tv" && deps.isTvPortalOpen()) deps.closeTvPortal();
    else if (inSnake) {
      deps.scene.pressNokiaButton("back", !deps.audio.isMuted());
      deps.requestFrame();
    } else deps.setFocusTarget(null);
    return true;
  }
  if (focus === "phone") {
    if (!deps.scene.handleNokiaKey(event.key, !deps.audio.isMuted())) return false;
    event.preventDefault();
    deps.requestFrame();
    return true;
  }
  if (focus === "chair") return handleTvShortcutKey(event, deps);
  if (focus !== "tv" || deps.isTvPortalOpen()) return false;
  if (handleTvShortcutKey(event, deps)) return true;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openActiveProject(deps.getActiveIndex(), deps.openInTv);
    return true;
  }
  const dir = deps.physics.applyKeyNavigation(event.key, PROJECT_COUNT);
  if (dir === 0) return false;
  event.preventDefault();
  deps.autoplay.notifyUserInteraction(dir);
  deps.requestFrame();
  return true;
};

export const handleStudioKeyDown = (event: KeyboardEvent, deps: StudioInputDeps): void => {
  if (dispatchStudioKey(event, deps)) deps.updatePointerHover(-2, -2, true);
};
