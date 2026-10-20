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
