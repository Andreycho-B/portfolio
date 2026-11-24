import { gsap } from "gsap";
import Matter from "matter-js";
import { applyCursorCollision, type LogoBinding } from "./tech-gravity-collision";

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
      const w = el.offsetWidth || 76;
      const h = el.offsetHeight || 76;
      const cols = Math.max(2, Math.floor(width / (w + 18)));
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = (width / (cols + 1)) * (col + 1) - w / 2;
      const y = height - (row + 1) * (h + 14);
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

  const bindings: LogoBinding[] = [];

  logoElements.forEach((el, index) => {
    const shape = el.dataset.shape ?? "circle";
    const w = el.offsetWidth || 76;
    const h = el.offsetHeight || 76;
    const halfW = w / 2;
    const halfH = h / 2;
    const cols = Math.max(2, Math.floor(width / (w + 14)));
    const startX = (width / (cols + 1)) * ((index % cols) + 1) + (Math.random() - 0.5) * 36;
    const startY = 32 + (Math.random() - 0.5) * 20;
    const rad = shape === "squircle" ? 22 : shape === "pill" ? halfH : 18;
    const bOpt = { restitution: 0.38, friction: 0.2, frictionAir: 0.015 };

    const body =
      shape === "circle"
        ? Matter.Bodies.circle(startX, startY, halfW, bOpt)
        : Matter.Bodies.rectangle(startX, startY, w, h, { ...bOpt, chamfer: { radius: rad } });

    gsap.set(el, { opacity: 0, scale: 0.35 });
    bindings.push({ body, el, halfW, halfH, active: false });
  });

  let [mouseX, mouseY, prevX, prevY] = [-9999, -9999, -9999, -9999];
  let containerRect = container.getBoundingClientRect();
  const refreshRect = () => {
    containerRect = container.getBoundingClientRect();
  };
  const onMouseMove = (e: MouseEvent) => {
    mouseX = e.clientX - containerRect.left;
    mouseY = e.clientY - containerRect.top;
  };
  const onMouseLeave = () => {
    mouseX = mouseY = prevX = prevY = -9999;
    Matter.Body.setPosition(cursorBall, { x: -9999, y: -9999 });
  };
  container.addEventListener("mouseenter", refreshRect, { passive: true });
  container.addEventListener("mousemove", onMouseMove, { passive: true });
  container.addEventListener("mouseleave", onMouseLeave, { passive: true });

  let animId = 0;
  let isRunning = false;
  let lastFrameMs = 0;
  const timeouts: ReturnType<typeof setTimeout>[] = [];
  let spawnedBatches = 0;

  const clearPendingSpawns = () => {
    for (const timer of timeouts) clearTimeout(timer);
    timeouts.length = 0;
  };
  const spawnStaggeredWaves = () => {
    const bSize = 6;
    const totalBatches = Math.ceil(bindings.length / bSize);
    const startBatch = spawnedBatches;
    if (startBatch >= totalBatches) return;
    clearPendingSpawns();
    for (let b = startBatch; b < totalBatches; b++) {
      const delay = (b - startBatch) * 150;
      const timer = setTimeout(() => {
        if (!isRunning) return;
        spawnedBatches = Math.max(spawnedBatches, b + 1);
        const startIdx = b * bSize;
        const endIdx = Math.min(bindings.length, startIdx + bSize);
        const bodiesToAdd: Matter.Body[] = [];
        for (let i = startIdx; i < endIdx; i++) {
          const item = bindings[i];
          if (!item || item.active) continue;
          item.active = true;
          bodiesToAdd.push(item.body);
          gsap.to(item.el, { opacity: 1, scale: 1, duration: 0.38, ease: "back.out(1.4)" });
        }
        if (bodiesToAdd.length > 0) Matter.Composite.add(engine.world, bodiesToAdd);
      }, delay);
      timeouts.push(timer);
    }
  };

  const updateLoop = (now: number) => {
    const dtMs = lastFrameMs > 0 ? Math.min(Math.max(now - lastFrameMs, 4), 24) : 16.667;
    lastFrameMs = now;
    if (mouseX > -500 && mouseY > -500) {
      const vx = prevX > -500 ? (mouseX - prevX) * 0.85 : 0;
      const vy = prevY > -500 ? (mouseY - prevY) * 0.85 : 0;
      const speed = Math.hypot(vx, vy);
      Matter.Body.setPosition(cursorBall, { x: mouseX, y: mouseY });
      Matter.Body.setVelocity(cursorBall, { x: vx, y: vy });

      applyCursorCollision(bindings, mouseX, mouseY, vx, vy, speed);
      prevX = mouseX;
      prevY = mouseY;
    }

    Matter.Engine.update(engine, dtMs);

    for (let i = 0; i < bindings.length; i++) {
      const item = bindings[i];
      if (!item?.active) continue;
      const { body, el, halfW, halfH } = item;
      el.style.transform = `translate3d(${(body.position.x - halfW).toFixed(2)}px, ${(body.position.y - halfH).toFixed(2)}px, 0) rotate(${body.angle.toFixed(4)}rad)`;
    }

    if (isRunning) animId = requestAnimationFrame(updateLoop);
  };

  const start = () => {
    if (isRunning) return;
    isRunning = true;
    lastFrameMs = 0;
    refreshRect();
    spawnStaggeredWaves();
    animId = requestAnimationFrame(updateLoop);
  };
  const stop = () => {
    isRunning = false;
    lastFrameMs = 0;
    clearPendingSpawns();
    if (animId) cancelAnimationFrame(animId);
    animId = 0;
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) start();
        else stop();
      });
    },
    { threshold: 0.05 },
  );
  observer.observe(container);

  const handleResize = () => {
    refreshRect();
    const newW = Math.max(container.clientWidth, 320);
    const newH = Math.max(container.clientHeight, 360);
    Matter.Body.setPosition(ground, { x: newW / 2, y: newH + 10 });
    Matter.Body.setPosition(rightWall, { x: newW + 20, y: newH / 2 });
    Matter.Body.setPosition(leftWall, { x: -20, y: newH / 2 });
  };
  window.addEventListener("resize", handleResize, { passive: true });
  window.addEventListener("scroll", refreshRect, { passive: true });

  return {
    destroy: () => {
      stop();
      observer.disconnect();
      container.removeEventListener("mouseenter", refreshRect);
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", refreshRect);
      Matter.Composite.clear(engine.world, false);
      Matter.Engine.clear(engine);
    },
  };
}
