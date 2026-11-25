import { gsap } from "gsap";
import Matter from "matter-js";
import {
  applyCursorCollision,
  createLogoBindings,
  syncLogoTransforms,
} from "./tech-gravity-collision";

interface TechGravityHandle {
  destroy: () => void;
}

export function initTechGravity(container: HTMLElement): TechGravityHandle | null {
  const logoElements = Array.from(container.querySelectorAll<HTMLElement>("[data-tech-logo]"));
  if (logoElements.length === 0) return null;

  const width = Math.max(container.clientWidth, 320);
  const height = Math.max(container.clientHeight, 360);
  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReduced) {
    logoElements.forEach((el, index) => {
      const [w, h] = [el.offsetWidth || 76, el.offsetHeight || 76];
      const cols = Math.max(2, Math.floor(width / (w + 18)));
      const x = (width / (cols + 1)) * ((index % cols) + 1) - w / 2;
      const y = height - (Math.floor(index / cols) + 1) * (h + 14);
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${Math.max(16, y).toFixed(1)}px, 0)`;
      el.style.opacity = "1";
    });
    return { destroy: () => {} };
  }

  const engine = Matter.Engine.create({ gravity: { x: 0, y: 1.15, scale: 0.001 } });
  const wOpt = { isStatic: true, friction: 0.35, restitution: 0.3 };
  const ground = Matter.Bodies.rectangle(width / 2, height + 10, width * 2, 20, wOpt);
  const leftWall = Matter.Bodies.rectangle(-20, height / 2, 40, height * 2, wOpt);
  const rightWall = Matter.Bodies.rectangle(width + 20, height / 2, 40, height * 2, wOpt);
  const ceiling = Matter.Bodies.rectangle(width / 2, -100, width * 2, 50, wOpt);
  const cursorBall = Matter.Bodies.circle(-9999, -9999, 46, { isStatic: true, restitution: 0.85 });
  Matter.Composite.add(engine.world, [ground, leftWall, rightWall, ceiling, cursorBall]);

  const bindings = createLogoBindings(logoElements, width);
  const totalBatches = Math.ceil(bindings.length / 6);
  let [mouseX, mouseY, prevX, prevY] = [-9999, -9999, -9999, -9999];
  let [animId, lastFrameMs, spawnedBatches, idleFrames] = [0, 0, 0, 0];
  let isVisible = false;
  let containerRect = container.getBoundingClientRect();
  const timeouts: ReturnType<typeof setTimeout>[] = [];

  const refreshRect = (): void => {
    containerRect = container.getBoundingClientRect();
  };
  const wakeLoop = (): void => {
    if (!isVisible || animId !== 0 || document.visibilityState === "hidden") return;
    [lastFrameMs, idleFrames] = [0, 0];
    animId = requestAnimationFrame(updateLoop);
  };
  const onMouseEnter = (): void => {
    refreshRect();
    wakeLoop();
  };
  const onMouseMove = (e: MouseEvent): void => {
    mouseX = e.clientX - containerRect.left;
    mouseY = e.clientY - containerRect.top;
    wakeLoop();
  };
  const onMouseLeave = (): void => {
    mouseX = mouseY = prevX = prevY = -9999;
    Matter.Body.setPosition(cursorBall, { x: -9999, y: -9999 });
  };
  container.addEventListener("mouseenter", onMouseEnter, { passive: true });
  container.addEventListener("mousemove", onMouseMove, { passive: true });
  container.addEventListener("mouseleave", onMouseLeave, { passive: true });

  const clearPendingSpawns = (): void => {
    for (const timer of timeouts) clearTimeout(timer);
    timeouts.length = 0;
  };
  const spawnStaggeredWaves = (): void => {
    const startBatch = spawnedBatches;
    if (startBatch >= totalBatches) return;
    clearPendingSpawns();
    for (let b = startBatch; b < totalBatches; b++) {
      const timer = setTimeout(
        () => {
          if (!isVisible) return;
          spawnedBatches = Math.max(spawnedBatches, b + 1);
          const bodiesToAdd: Matter.Body[] = [];
          const endIdx = Math.min(bindings.length, (b + 1) * 6);
          for (let i = b * 6; i < endIdx; i++) {
            const binding = bindings[i];
            if (!binding || binding.active) continue;
            binding.active = true;
            bodiesToAdd.push(binding.body);
            gsap.to(binding, { spawnScale: 1, duration: 0.38, ease: "back.out(1.4)" });
            gsap.to(binding.el, { opacity: 1, duration: 0.32, ease: "power2.out" });
          }
          if (bodiesToAdd.length > 0) {
            Matter.Composite.add(engine.world, bodiesToAdd);
            wakeLoop();
          }
        },
        (b - startBatch) * 150,
      );
      timeouts.push(timer);
    }
  };

  const updateLoop = (now: number): void => {
    animId = 0;
    if (!isVisible || document.visibilityState === "hidden") return;
    const dtMs = lastFrameMs > 0 ? Math.min(Math.max(now - lastFrameMs, 4), 16.667) : 16.667;
    lastFrameMs = now;
    const pointerInside = mouseX > -500 && mouseY > -500;
    if (pointerInside) {
      const vx = prevX > -500 ? (mouseX - prevX) * 0.85 : 0;
      const vy = prevY > -500 ? (mouseY - prevY) * 0.85 : 0;
      Matter.Body.setPosition(cursorBall, { x: mouseX, y: mouseY });
      Matter.Body.setVelocity(cursorBall, { x: vx, y: vy });
      applyCursorCollision(bindings, mouseX, mouseY, vx, vy, Math.hypot(vx, vy));
      [prevX, prevY] = [mouseX, mouseY];
    }
    Matter.Engine.update(engine, dtMs);
    const anyMoved = syncLogoTransforms(bindings);
    if (anyMoved || pointerInside || spawnedBatches < totalBatches) idleFrames = 0;
    else idleFrames += 1;
    if (idleFrames < 45) animId = requestAnimationFrame(updateLoop);
  };

  const stop = (): void => {
    [isVisible, lastFrameMs] = [false, 0];
    clearPendingSpawns();
    if (animId) cancelAnimationFrame(animId);
    animId = 0;
  };
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          if (!isVisible) {
            isVisible = true;
            refreshRect();
            spawnStaggeredWaves();
            wakeLoop();
          }
        } else stop();
      }
    },
    { threshold: 0.05 },
  );
  observer.observe(container);

  const handleResize = (): void => {
    refreshRect();
    const newW = Math.max(container.clientWidth, 320);
    const newH = Math.max(container.clientHeight, 360);
    Matter.Body.setPosition(ground, { x: newW / 2, y: newH + 10 });
    Matter.Body.setPosition(rightWall, { x: newW + 20, y: newH / 2 });
    Matter.Body.setPosition(leftWall, { x: -20, y: newH / 2 });
    wakeLoop();
  };
  const onVisibility = (): void => {
    if (document.visibilityState === "visible") wakeLoop();
  };
  window.addEventListener("resize", handleResize, { passive: true });
  window.addEventListener("scroll", refreshRect, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);

  return {
    destroy: () => {
      stop();
      observer.disconnect();
      container.removeEventListener("mouseenter", onMouseEnter);
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", refreshRect);
      document.removeEventListener("visibilitychange", onVisibility);
      Matter.Composite.clear(engine.world, false);
      Matter.Engine.clear(engine);
    },
  };
}
