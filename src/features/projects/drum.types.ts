export const consumeDetentStep = (
  curr: number,
  state: { prevPos: number; lastDetentPos: number },
): boolean => {
  if (curr === state.prevPos) return false;
  state.prevPos = curr;
  const diff = curr - state.lastDetentPos;
  if (Math.abs(diff) < 0.5) return false;
  state.lastDetentPos += Math.trunc(diff / 0.5) * 0.5;
  return true;
};

export const observeCanvasResize = (
  canvas: HTMLCanvasElement,
  onResize: (rect: DOMRect) => void,
): (() => void) => {
  let frameId: number | null = null;
  const trigger = () => {
    if (frameId !== null) return;
    frameId = requestAnimationFrame(() => {
      frameId = null;
      onResize(canvas.getBoundingClientRect());
    });
  };
  const observer = new ResizeObserver(trigger);
  observer.observe(canvas);
  window.addEventListener("resize", trigger);
  return () => {
    if (frameId !== null) cancelAnimationFrame(frameId);
    window.removeEventListener("resize", trigger);
    observer.disconnect();
  };
};
