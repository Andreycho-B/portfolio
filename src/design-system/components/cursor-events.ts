import type { CursorController } from "./cursor.types";

interface CursorEventHandlers {
  readonly onMove: (clientX: number, clientY: number) => void;
  readonly onDown: () => void;
  readonly onUp: () => void;
  readonly onLeave: () => void;
  readonly onEnter: () => void;
}

export const bindCursorEvents = (handlers: CursorEventHandlers): (() => void) => {
  const handlePointerMove = (e: PointerEvent) => handlers.onMove(e.clientX, e.clientY);
  const handlePointerDown = () => handlers.onDown();
  const handlePointerUp = () => handlers.onUp();
  const handleMouseLeave = () => handlers.onLeave();
  const handleMouseEnter = () => handlers.onEnter();

  window.addEventListener("pointermove", handlePointerMove as EventListener, { passive: true });
  window.addEventListener("pointerdown", handlePointerDown);
  window.addEventListener("pointerup", handlePointerUp);
  document.documentElement.addEventListener("mouseleave", handleMouseLeave);
  document.documentElement.addEventListener("mouseenter", handleMouseEnter);

  return () => {
    window.removeEventListener("pointermove", handlePointerMove as EventListener);
    window.removeEventListener("pointerdown", handlePointerDown);
    window.removeEventListener("pointerup", handlePointerUp);
    document.documentElement.removeEventListener("mouseleave", handleMouseLeave);
    document.documentElement.removeEventListener("mouseenter", handleMouseEnter);
  };
};

export const bindCursorExpandTriggers = (
  root: ParentNode,
  cursor: CursorController,
): (() => void) => {
  const elements = Array.from(root.querySelectorAll<HTMLElement>("[data-cursor-expand]"));
  const cleanups = elements.map((el) => {
    const label = el.dataset.cursorExpand;
    const onEnter = () => cursor.setExpanded(true, label);
    const onLeave = () => cursor.setExpanded(false);
    const onClick = () => {
      cursor.setExpanded(false);
      cursor.setPressed(false);
    };
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("click", onClick);
    };
  });

  return () => {
    for (const fn of cleanups) fn();
  };
};

export const registerCursorSwapReset = (getActive: () => CursorController | null): void => {
  if (typeof document === "undefined") return;
  const resetState = () => {
    const active = getActive();
    active?.setExpanded(false);
    active?.setPressed(false);
    active?.setInverted(false);
    document
      .querySelector<HTMLElement>("[data-interactive-cursor]")
      ?.classList.remove("is-expanded", "is-pressed", "is-muted", "is-inverted");
    const textEl = document.querySelector<HTMLElement>("[data-cursor-text]");
    if (textEl) textEl.textContent = "Ver";
  };
  for (const evt of ["astro:before-swap", "astro:after-swap", "astro:page-load"] as const) {
    document.addEventListener(evt, resetState);
  }
};
