import { getAudioSystem } from "../../core/audio";
import { getCursorController } from "../../design-system/components/cursor-controller";

export const initSoundToggle = (root: HTMLElement): (() => void) => {
  const button = root.querySelector<HTMLButtonElement>("[data-sound-toggle]");
  const stateLabel = root.querySelector<HTMLElement>("[data-sound-state]");
  if (!button || !stateLabel) return () => {};

  const audio = getAudioSystem();
  const cursor = getCursorController();
  let isHovered = false;

  const syncUI = (isMuted: boolean) => {
    stateLabel.textContent = isMuted ? "[OFF]" : "[ON]";
    button.setAttribute("aria-label", isMuted ? "Activar sonido" : "Silenciar sonido");
    button.setAttribute("aria-pressed", isMuted ? "true" : "false");
    button.dataset.muted = isMuted ? "true" : "false";
  };

  const updateCursorState = (isMuted: boolean) => {
    if (!isHovered) return;
    if (isMuted) {
      cursor.setMuted(false);
      cursor.setExpanded(true, "Activar");
    } else {
      cursor.setExpanded(false);
      cursor.setMuted(true);
    }
  };

  syncUI(audio.isMuted());

  const handleClick = (event: MouseEvent) => {
    event.stopPropagation();
    const isMuted = audio.toggleMute();
    syncUI(isMuted);
    updateCursorState(isMuted);
  };

  const handlePointerEnter = () => {
    isHovered = true;
    updateCursorState(audio.isMuted());
  };

  const handlePointerLeave = () => {
    isHovered = false;
    cursor.setMuted(false);
    cursor.setExpanded(false);
  };

  button.addEventListener("click", handleClick);
  button.addEventListener("pointerenter", handlePointerEnter);
  button.addEventListener("pointerleave", handlePointerLeave);

  return () => {
    button.removeEventListener("click", handleClick);
    button.removeEventListener("pointerenter", handlePointerEnter);
    button.removeEventListener("pointerleave", handlePointerLeave);
    if (isHovered) {
      cursor.setMuted(false);
      cursor.setExpanded(false);
    }
  };
};
