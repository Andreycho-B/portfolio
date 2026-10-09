import { createSpring2D } from "../../design-system/components/spring-physics";
import type { CloudControllerHandle, CloudCursorState, TextClearZone } from "./cloud.types";
import { createCloudRenderer } from "./cloud-renderer";

export const initCloudCanvas = (canvas: HTMLCanvasElement): CloudControllerHandle | null => {
  const renderer = createCloudRenderer(canvas);
  if (!renderer) return null;

  const contentEl = document.querySelector<HTMLElement>("[data-consent-content]");
  const actionsEl = document.querySelector<HTMLElement>("[data-consent-actions]");

  let animationFrameId: number | null = null;
  let isRevealed = false;
  let lastTime = performance.now();
  let startTime = performance.now();

  const spring = createSpring2D({
    stiffness: 90,
    damping: 14,
    mass: 1.0,
  });

  let hasPointer = false;
  let cursorStrength = 0;
  const cursor: CloudCursorState = { x: 0, y: 0, strength: 0 };

  let textClearZone: TextClearZone = [
    canvas.width * 0.5,
    canvas.height * 0.5,
    canvas.width * 0.32,
    canvas.height * 0.24,
  ];

  let actionZone: TextClearZone = [canvas.width * 0.5, 48, 120, 32];

  const updateZones = () => {
    if (contentEl) {
      const rect = contentEl.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = canvas.height - (rect.top + rect.height * 0.5);
      const rx = rect.width * 0.5 + 64;
      const ry = rect.height * 0.5 + 56;
      textClearZone = [cx, cy, rx, ry];
    }
    if (actionsEl) {
      const rect = actionsEl.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = canvas.height - (rect.top + rect.height * 0.5);
      const rx = Math.max(rect.width * 0.5, 60);
      const ry = Math.max(rect.height * 0.5, 20);
      actionZone = [cx, cy, rx, ry];
    }
  };

  let pixelScale = 2.4;
  let canvasRect = canvas.getBoundingClientRect();

  const resize = () => {
    const width = canvas.parentElement?.clientWidth ?? window.innerWidth;
    const height = canvas.parentElement?.clientHeight ?? window.innerHeight;
    const isMobile = width < 768;
    const renderScale = isMobile ? 0.75 : 0.85;
    canvas.width = Math.floor(width * renderScale);
    canvas.height = Math.floor(height * renderScale);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvasRect = canvas.getBoundingClientRect();

    pixelScale = isMobile ? 2.4 : 1.9;

    renderer.resize(canvas.width, canvas.height);
    updateZones();
  };
  resize();

  const handlePointerCoord = (e: PointerEvent) => {
    const targetX = e.clientX - canvasRect.left;
    const targetY = e.clientY - canvasRect.top;

    spring.targetX = targetX;
    spring.targetY = targetY;

    if (!hasPointer) {
      spring.reset(targetX, targetY);
      hasPointer = true;
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    handlePointerCoord(e);
  };

  const onPointerMove = (e: PointerEvent) => {
    handlePointerCoord(e);
  };

  const onPointerEnd = () => {
    hasPointer = false;
  };

  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerup", onPointerEnd, { passive: true });
  window.addEventListener("pointercancel", onPointerEnd, { passive: true });
  window.addEventListener("pointerleave", onPointerEnd, { passive: true });
  window.addEventListener("resize", resize);
  document.addEventListener("morphic:phrase-start", updateZones);

  let cloudProgress = 0;

  const loop = (now: number) => {
    const dt = Math.min(Math.max((now - lastTime) / 1000, 0.001), 0.033);
    lastTime = now;
    const elapsed = (now - startTime) / 1000;

    if (cloudProgress < 1) {
      cloudProgress = Math.min(1, cloudProgress + dt / 2.2);
    }

    // Curva de atenuación suave (cubic ease) para una emergencia cinematográfica gradual
    const cloudOpacity =
      cloudProgress < 0.5
        ? 2 * cloudProgress * cloudProgress
        : 1 - (-2 * cloudProgress + 2) ** 2 / 2;

    spring.step(dt);

    if (hasPointer) {
      cursorStrength = Math.min(1.0, cursorStrength + dt * 4.0);
    } else {
      cursorStrength = Math.max(0.0, cursorStrength - dt * 2.5);
    }

    cursor.x = spring.currentX;
    cursor.y = spring.currentY;
    cursor.strength = cursorStrength;

    renderer.render(elapsed, cloudOpacity, cursor, textClearZone, actionZone, pixelScale);
    animationFrameId = requestAnimationFrame(loop);
  };

  canvas.classList.remove("is-revealed");

  const reveal = () => {
    if (isRevealed) return;
    isRevealed = true;
    canvas.classList.add("is-revealed");
    updateZones();
    lastTime = performance.now();
    startTime = performance.now();
    animationFrameId = requestAnimationFrame(loop);
  };

  const onCovered = () => {
    reveal();
  };
  document.addEventListener("welcome:backdrop-covered", onCovered, { once: true });

  const destroy = () => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    canvas.classList.remove("is-revealed");
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerEnd);
    window.removeEventListener("pointercancel", onPointerEnd);
    window.removeEventListener("pointerleave", onPointerEnd);
    window.removeEventListener("resize", resize);
    document.removeEventListener("welcome:backdrop-covered", onCovered);
    document.removeEventListener("morphic:phrase-start", updateZones);
    renderer.destroy();
  };

  document.addEventListener("astro:before-swap", destroy, { once: true });

  return { destroy, reveal };
};
