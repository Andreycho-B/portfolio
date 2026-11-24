import { PROJECT_COUNT } from "./project-data";
import type { StudioInputDeps, StudioScreenZone } from "./studio.types";
import { notifyStudioAudioSync } from "./studio-sound-toggle";
import type { TvButtonId } from "./studio-tv-buttons";
import { TV_CHANNEL_ORDER, type TvChannelMode } from "./studio-tv-channels";

export const TV_BUTTON_LABELS: Readonly<Record<TvButtonId, string>> = {
  ch1: "CH 1 · Mías",
  ch2: "CH 2 · Tu Súper",
  ch3: "CH 3 · Estándar",
  ch4: "CH 4 · Sobre mí",
  ch5: "CH 5 · DVD",
  ch6: "CH 6 · SMPTE",
  ch7: "CH 7 · Estática",
  ch8: "CH 8 · Terminal",
  ch9: "CH 9 · Reloj",
  ch0: "CH 0 · Inicio",
  ch_prev: "CH -",
  ch_next: "CH +",
  mute: "Sonido",
  power: "Encender",
  dvd: "DVD",
};

const RETRO_BY_BTN: Partial<Record<TvButtonId, TvChannelMode>> = {
  ch5: "dvd",
  dvd: "dvd",
  ch6: "smpte",
  ch7: "static",
  ch8: "terminal",
  ch9: "clock",
};

const SLOT_BY_BTN: Partial<Record<TvButtonId, number>> = { ch1: 0, ch2: 1, ch3: 2, ch0: 0 };

const ensureTvPoweredOn = (deps: StudioInputDeps): void => {
  if (deps.power.isPoweredOn) return;
  deps.power.toggle();
  deps.audio.playTactileFeedback("crt_power_on");
};

const stepDrumToSlot = (deps: StudioInputDeps, slotIndex: number): void => {
  const cur =
    ((Math.round(deps.physics.targetPosition) % PROJECT_COUNT) + PROJECT_COUNT) % PROJECT_COUNT;
  let delta = slotIndex - cur;
  if (delta > PROJECT_COUNT * 0.5) delta -= PROJECT_COUNT;
  if (delta < -PROJECT_COUNT * 0.5) delta += PROJECT_COUNT;
  if (delta !== 0) {
    deps.autoplay.notifyUserInteraction(delta > 0 ? 1 : -1);
    deps.physics.stepSlots(delta);
  }
};

export const isTvSpecialZone = (zone: StudioScreenZone): boolean =>
  zone === "bezel_exit" || zone === "tv_button" || zone === "power" || zone === "tv_channel_exit";

export const handleTvSpecialClick = (
  zone: StudioScreenZone,
  tvBtn: TvButtonId | null,
  isClick: boolean,
  deps: StudioInputDeps,
): boolean => {
  if (zone === "tv_button" || zone === "power") {
    if (isClick) executeTvButtonAction(tvBtn ?? "power", deps, deps.closeTvPortal);
    return true;
  }
  if (zone === "tv_channel_exit") {
    if (isClick) {
      deps.scene.setTvChannel("portfolio");
      deps.audio.playTactileFeedback("tv_zap");
      deps.cursor.pulse();
      deps.refreshHud();
    }
    return true;
  }
  if (zone === "bezel_exit") {
    if (isClick) {
      deps.cursor.pulse();
      deps.setFocusTarget(null);
    }
    return true;
  }
  return false;
};

export const executeTvButtonAction = (
  id: TvButtonId,
  deps: StudioInputDeps,
  closePortalIfOpen: () => void,
): void => {
  deps.scene.pressTvButtonVisual(id);
  deps.cursor.pulse();

  if (id === "power") {
    const on = deps.power.toggle();
    deps.audio.playTactileFeedback(on ? "crt_power_on" : "crt_power_off");
    deps.refreshHud();
    return;
  }

  if (id === "mute") {
    const muted = deps.audio.toggleMute();
    if (!muted) deps.audio.playTactileFeedback("click");
    notifyStudioAudioSync();
    deps.refreshHud();
    return;
  }

  ensureTvPoweredOn(deps);

  if (id === "ch4") {
    deps.audio.playTactileFeedback("tv_zap");
    deps.scene.setTvChannel("portfolio");
    deps.openInTv("/sobre-mi");
    deps.refreshHud();
    return;
  }

  const retro = RETRO_BY_BTN[id];
  if (retro) {
    deps.audio.playTactileFeedback("tv_zap");
    closePortalIfOpen();
    deps.scene.setTvChannel(retro);
    deps.refreshHud();
    return;
  }

  const slot = SLOT_BY_BTN[id];
  if (slot !== undefined) {
    const wasRetro = deps.scene.getTvChannel() !== "portfolio";
    deps.audio.playTactileFeedback(wasRetro ? "tv_zap" : "click");
    closePortalIfOpen();
    deps.scene.setTvChannel("portfolio");
    stepDrumToSlot(deps, slot);
    deps.refreshHud();
    return;
  }

  if (id === "ch_prev" || id === "ch_next") {
    const step = id === "ch_prev" ? -1 : 1;
    const current = deps.scene.getTvChannel();
    if (current === "portfolio" && !deps.isTvPortalOpen()) {
      deps.audio.playTactileFeedback("click");
      deps.autoplay.notifyUserInteraction(step);
      deps.physics.stepSlots(step);
    } else {
      deps.audio.playTactileFeedback("tv_zap");
      closePortalIfOpen();
      const idx = TV_CHANNEL_ORDER.indexOf(current);
      const next =
        TV_CHANNEL_ORDER[(idx + step + TV_CHANNEL_ORDER.length) % TV_CHANNEL_ORDER.length];
      if (next) deps.scene.setTvChannel(next);
    }
    deps.refreshHud();
  }
};
