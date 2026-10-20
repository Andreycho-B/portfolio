import { gsap } from "gsap";
import Matter from "matter-js";
import { applyCursorCollision, type LogoBinding } from "./tech-gravity-collision";

export interface TechGravityHandle {
  destroy: () => void;
}

export function initTechGravity(container: HTMLElement): TechGravityHandle | null {
  const logoElements = Array.from(container.querySelectorAll<HTMLElement>("[data-tech-logo]"));
  if (logoElements.length === 0) return null;

  const width = Math.max(container.clientWidth, 320);
  const height = Math.max(container.clientHeight, 360);
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

  let mouseX = -9999;
  let mouseY = -9999;
  let prevX = -9999;
  let prevY = -9999;
  const onMouseMove = (e: MouseEvent) => {
    const r = container.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
  };
  const onMouseLeave = () => {
    mouseX = -9999;
    mouseY = -9999;
    prevX = -9999;
    prevY = -9999;
    Matter.Body.setPosition(cursorBall, { x: -9999, y: -9999 });
  };
  container.addEventListener("mousemove", onMouseMove, { passive: true });
  container.addEventListener("mouseleave", onMouseLeave, { passive: true });

  let animId = 0;
  let isRunning = false;
  const timeouts: ReturnType<typeof setTimeout>[] = [];
  let hasSpawned = false;

  const spawnStaggeredWaves = () => {
    if (hasSpawned) return;
    hasSpawned = true;
    const bSize = 6;
    const totalBatches = Math.ceil(bindings.length / bSize);

    for (let b = 0; b < totalBatches; b++) {
      const timer = setTimeout(() => {
        if (!isRunning) return;
        const startIdx = b * bSize;
        const endIdx = Math.min(bindings.length, startIdx + bSize);
        const bodiesToAdd: Matter.Body[] = [];

        for (let i = startIdx; i < endIdx; i++) {
          const item = bindings[i];
          if (!item) continue;
          item.active = true;
          bodiesToAdd.push(item.body);
          gsap.to(item.el, { opacity: 1, scale: 1, duration: 0.38, ease: "back.out(1.4)" });
        }
        Matter.Composite.add(engine.world, bodiesToAdd);
      }, b * 150);
      timeouts.push(timer);
    }
  };

  const updateLoop = () => {
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

    Matter.Engine.update(engine, 1000 / 60);

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
    spawnStaggeredWaves();
    animId = requestAnimationFrame(updateLoop);
  };
  const stop = () => {
    isRunning = false;
    if (animId) {
      cancelAnimationFrame(animId);
      animId = 0;
    }
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
    const newW = Math.max(container.clientWidth, 320);
    const newH = Math.max(container.clientHeight, 360);
    Matter.Body.setPosition(ground, { x: newW / 2, y: newH + 10 });
    Matter.Body.setPosition(rightWall, { x: newW + 20, y: newH / 2 });
    Matter.Body.setPosition(leftWall, { x: -20, y: newH / 2 });
  };
  window.addEventListener("resize", handleResize, { passive: true });

  return {
    destroy: () => {
      stop();
      timeouts.forEach(clearTimeout);
      observer.disconnect();
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("resize", handleResize);
      Matter.Composite.clear(engine.world, false);
      Matter.Engine.clear(engine);
    },
  };
}
