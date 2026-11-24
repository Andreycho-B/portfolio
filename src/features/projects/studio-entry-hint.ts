import type { StudioFocusTarget } from "./studio-prop-focus";

export interface StudioEntryHintHandle {
  readonly reveal: () => void;
  readonly dismiss: () => void;
  readonly setFocus: (focus: StudioFocusTarget | null) => void;
  readonly dispose: () => void;
}

const DRAG_DISMISS_PX = 10;

export const createStudioEntryHint = (
  root: HTMLElement,
  onBack?: () => void,
): StudioEntryHintHandle => {
  const el = root.querySelector<HTMLElement>("[data-studio-entry-hint]");
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "studio-back-btn";
  backBtn.hidden = true;
  backBtn.textContent = "← Volver";
  backBtn.setAttribute("data-studio-back-btn", "");
  backBtn.setAttribute("aria-label", "Volver al estudio");
  backBtn.setAttribute("data-nosnippet", "");
  root.appendChild(backBtn);
  const onBackClick = (event: MouseEvent): void => {
    event.stopPropagation();
    onBack?.();
  };
  backBtn.addEventListener("click", onBackClick);
  const setFocus = (focus: StudioFocusTarget | null): void => {
    if (focus !== null) dismiss();
    backBtn.hidden = focus === null;
    if (focus === null) return;
    const isChair = focus === "chair";
    backBtn.textContent = isChair ? "← Levantarse" : "← Volver";
    backBtn.setAttribute("aria-label", isChair ? "Levantarse de la silla" : "Volver al estudio");
  };
  const cleanupBack = (): void => {
    backBtn.removeEventListener("click", onBackClick);
    backBtn.remove();
  };
  if (!el) return { reveal: () => {}, dismiss: () => {}, setFocus, dispose: cleanupBack };

  let dismissed = false;
  let visible = false;
  let downX = 0;
  let downY = 0;
  let tracking = false;

  const dismiss = (): void => {
    if (dismissed) return;
    dismissed = true;
    visible = false;
    tracking = false;
    delete el.dataset.visible;
    el.dataset.dismissed = "true";
    unbind();
  };

  const reveal = (): void => {
    if (dismissed || visible) return;
    visible = true;
    el.dataset.visible = "true";
  };

  const onDown = (event: PointerEvent): void => {
    if (!visible || dismissed) return;
    if (event.target instanceof Element && event.target.closest("[data-studio-sound-toggle]")) {
      return;
    }
    tracking = true;
    downX = event.clientX;
    downY = event.clientY;
  };

  const onMove = (event: PointerEvent): void => {
    if (!tracking || dismissed) return;
    if (Math.hypot(event.clientX - downX, event.clientY - downY) >= DRAG_DISMISS_PX) dismiss();
  };

  const onUp = (): void => {
    tracking = false;
  };

  const unbind = (): void => {
    root.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  root.addEventListener("pointerdown", onDown, { passive: true });
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", onUp, { passive: true });

  return {
    reveal,
    dismiss,
    setFocus,
    dispose: () => {
      unbind();
      cleanupBack();
    },
  };
};
