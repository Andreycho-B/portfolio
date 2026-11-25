import type { StudioFocusTarget } from "./studio-prop-focus";

export interface StudioEntryHintHandle {
  readonly reveal: () => void;
  readonly dismiss: () => void;
  readonly setFocus: (focus: StudioFocusTarget | null) => void;
  readonly syncTvScroll: (eligible: boolean) => void;
  readonly dispose: () => void;
}

const DRAG_DISMISS_PX = 10;
const TV_SCROLL_REVEAL_MS = 360;
const DRUM_SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);

export const createStudioEntryHint = (
  root: HTMLElement,
  onBack?: () => void,
): StudioEntryHintHandle => {
  const el = root.querySelector<HTMLElement>("[data-studio-entry-hint]");
  const scrollEl = root.querySelector<HTMLElement>("[data-studio-scroll-hint]");
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

  const entry = { dismissed: false, visible: false, downX: 0, downY: 0, tracking: false };
  const scroll = {
    dismissed: false,
    eligible: false,
    visible: false,
    timer: null as number | null,
    downY: 0,
    tracking: false,
  };

  const clearScrollTimer = (): void => {
    if (scroll.timer === null) return;
    window.clearTimeout(scroll.timer);
    scroll.timer = null;
  };
  const hideScroll = (): void => {
    clearScrollTimer();
    scroll.tracking = false;
    if (scroll.visible && scrollEl) delete scrollEl.dataset.visible;
    scroll.visible = false;
  };
  const onScrollWheel = (event: WheelEvent): void => {
    if (!scroll.eligible || scroll.dismissed) return;
    if (Math.abs(event.deltaY) >= 2 || Math.abs(event.deltaX) >= 2) dismissScroll();
  };
  const onScrollKey = (event: KeyboardEvent): void => {
    if (!scroll.eligible || scroll.dismissed) return;
    if (DRUM_SCROLL_KEYS.has(event.key)) dismissScroll();
  };
  const onScrollDown = (event: PointerEvent): void => {
    if (!scroll.eligible || scroll.dismissed) return;
    [scroll.tracking, scroll.downY] = [true, event.clientY];
  };
  const onScrollMove = (event: PointerEvent): void => {
    if (!scroll.tracking || !scroll.eligible || scroll.dismissed) return;
    if (Math.abs(event.clientY - scroll.downY) >= DRAG_DISMISS_PX) dismissScroll();
  };
  const onScrollUp = (): void => {
    scroll.tracking = false;
  };
  const unbindScroll = (): void => {
    window.removeEventListener("wheel", onScrollWheel);
    window.removeEventListener("keydown", onScrollKey);
    root.removeEventListener("pointerdown", onScrollDown);
    window.removeEventListener("pointermove", onScrollMove);
    window.removeEventListener("pointerup", onScrollUp);
  };
  const dismissScroll = (): void => {
    if (scroll.dismissed) return;
    [scroll.dismissed, scroll.eligible] = [true, false];
    hideScroll();
    if (scrollEl) scrollEl.dataset.dismissed = "true";
    unbindScroll();
  };
  const syncTvScroll = (eligible: boolean): void => {
    if (!scrollEl || scroll.dismissed || eligible === scroll.eligible) return;
    scroll.eligible = eligible;
    if (!eligible) {
      hideScroll();
      return;
    }
    clearScrollTimer();
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      scroll.visible = true;
      scrollEl.dataset.visible = "true";
      return;
    }
    scroll.timer = window.setTimeout(() => {
      scroll.timer = null;
      if (!scroll.eligible || scroll.dismissed) return;
      scroll.visible = true;
      scrollEl.dataset.visible = "true";
    }, TV_SCROLL_REVEAL_MS);
  };
  if (scrollEl) {
    window.addEventListener("wheel", onScrollWheel, { passive: true });
    window.addEventListener("keydown", onScrollKey);
    root.addEventListener("pointerdown", onScrollDown, { passive: true });
    window.addEventListener("pointermove", onScrollMove, { passive: true });
    window.addEventListener("pointerup", onScrollUp, { passive: true });
  }

  const onDown = (event: PointerEvent): void => {
    if (!entry.visible || entry.dismissed) return;
    if (event.target instanceof Element && event.target.closest("[data-studio-sound-toggle]")) {
      return;
    }
    [entry.tracking, entry.downX, entry.downY] = [true, event.clientX, event.clientY];
  };
  const onMove = (event: PointerEvent): void => {
    if (!entry.tracking || entry.dismissed) return;
    if (Math.hypot(event.clientX - entry.downX, event.clientY - entry.downY) >= DRAG_DISMISS_PX) {
      dismiss();
    }
  };
  const onUp = (): void => {
    entry.tracking = false;
  };
  const unbindEntry = (): void => {
    root.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };
  const dismiss = (): void => {
    if (entry.dismissed) return;
    [entry.dismissed, entry.visible, entry.tracking] = [true, false, false];
    if (el) {
      delete el.dataset.visible;
      el.dataset.dismissed = "true";
    }
    unbindEntry();
  };
  const reveal = (): void => {
    if (!el || entry.dismissed || entry.visible) return;
    entry.visible = true;
    el.dataset.visible = "true";
  };
  if (el) {
    root.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
  }

  const setFocus = (focus: StudioFocusTarget | null): void => {
    if (focus !== null) dismiss();
    if (focus !== "tv") syncTvScroll(false);
    backBtn.hidden = focus === null;
    if (focus === null) return;
    const isChair = focus === "chair";
    backBtn.textContent = isChair ? "← Levantarse" : "← Volver";
    backBtn.setAttribute("aria-label", isChair ? "Levantarse de la silla" : "Volver al estudio");
  };

  return {
    reveal,
    dismiss,
    setFocus,
    syncTvScroll,
    dispose: () => {
      unbindEntry();
      clearScrollTimer();
      unbindScroll();
      backBtn.removeEventListener("click", onBackClick);
      backBtn.remove();
    },
  };
};
