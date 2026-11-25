import type { AudioEngineContract } from "../../core/audio.types";
import type { CursorController } from "../../design-system/components/cursor-controller";

export const STUDIO_AUDIO_SYNC_EVENT = "studio:audio-sync";

export interface StudioSoundToggleHandle {
  readonly sync: () => void;
  readonly isHovered: () => boolean;
  readonly dispose: () => void;
}

export const notifyStudioAudioSync = (): void => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STUDIO_AUDIO_SYNC_EVENT));
  if (window.parent && window.parent !== window) {
    try {
      window.parent.dispatchEvent(new Event(STUDIO_AUDIO_SYNC_EVENT));
    } catch (err: unknown) {
      if (!(err instanceof DOMException)) throw err;
    }
  }
  for (const frame of document.querySelectorAll<HTMLIFrameElement>("iframe")) {
    try {
      frame.contentWindow?.dispatchEvent(new Event(STUDIO_AUDIO_SYNC_EVENT));
    } catch (err: unknown) {
      if (!(err instanceof DOMException)) throw err;
    }
  }
};

export const bindStudioSoundToggle = (
  root: ParentNode,
  audio: AudioEngineContract,
  cursor: CursorController,
  onHoverStart: () => void,
  onToggled: () => void,
): StudioSoundToggleHandle => {
  const button = root.querySelector<HTMLButtonElement>("[data-studio-sound-toggle]");
  if (!button) return { sync: () => {}, isHovered: () => false, dispose: () => {} };

  let hovered = false;
  let lastMuted: boolean | null = null;

  const applyCursor = (muted: boolean): void => {
    if (!hovered) return;
    cursor.setInverted(true);
    if (muted) {
      cursor.setMuted(false);
      cursor.setExpanded(true, "Activar");
    } else {
      cursor.setExpanded(false);
      cursor.setMuted(true);
    }
  };

  const sync = (): void => {
    const muted = audio.isMuted();
    if (muted !== lastMuted) {
      lastMuted = muted;
      button.dataset.muted = muted ? "true" : "false";
      button.setAttribute("aria-pressed", muted ? "false" : "true");
      button.setAttribute(
        "aria-label",
        muted ? "Activar modo ambiente" : "Silenciar modo ambiente",
      );
    }
    if (hovered) applyCursor(muted);
  };

  const onClick = (event: MouseEvent): void => {
    event.stopPropagation();
    const muted = audio.toggleMute();
    if (!muted) audio.playTactileFeedback("click");
    cursor.pulse();
    sync();
    notifyStudioAudioSync();
    onToggled();
  };

  const onEnter = (): void => {
    hovered = true;
    onHoverStart();
    applyCursor(audio.isMuted());
  };

  const onLeave = (): void => {
    hovered = false;
    cursor.setMuted(false);
    cursor.setExpanded(false);
    onToggled();
  };

  button.addEventListener("click", onClick);
  button.addEventListener("pointerenter", onEnter);
  button.addEventListener("pointerleave", onLeave);
  window.addEventListener(STUDIO_AUDIO_SYNC_EVENT, sync);
  document.addEventListener("consent:completed", sync);
  sync();

  return {
    sync,
    isHovered: () => hovered,
    dispose: () => {
      button.removeEventListener("click", onClick);
      button.removeEventListener("pointerenter", onEnter);
      button.removeEventListener("pointerleave", onLeave);
      window.removeEventListener(STUDIO_AUDIO_SYNC_EVENT, sync);
      document.removeEventListener("consent:completed", sync);
    },
  };
};
