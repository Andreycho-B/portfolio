export interface StudioEntryHintHandle {
  readonly reveal: () => void;
  readonly dismiss: () => void;
  readonly dispose: () => void;
}

const DRAG_DISMISS_PX = 10;

export const createStudioEntryHint = (root: HTMLElement): StudioEntryHintHandle => {
  const el = root.querySelector<HTMLElement>("[data-studio-entry-hint]");
  if (!el) return { reveal: () => {}, dismiss: () => {}, dispose: () => {} };

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

  return { reveal, dismiss, dispose: unbind };
};
