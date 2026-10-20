export function initParticleText(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  let particleData = new Float32Array(0);
  let particleCount = 0;
  let particleSize = 1.4;
  let animId = 0;
  let isVisible = false;
  let resizeTimer = 0;

  const mouse = { x: -9999, y: -9999, radius: 220, isInteracting: false };
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  function createParticles() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);

    const offscreen = document.createElement("canvas");
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return;

    const maxTextWidth = canvas.width * 0.98;
    const maxTextHeight = canvas.height * 0.94;
    let fontSize = Math.floor(maxTextHeight);
    if ("letterSpacing" in offCtx) {
      offCtx.letterSpacing = "-0.04em";
    }
    offCtx.font = `900 ${fontSize}px "Author", "Cabinet Grotesk", system-ui, sans-serif`;
    const measured = offCtx.measureText("ANDREY").width;
    if (measured > 0) {
      const scaleW = maxTextWidth / measured;
      const scaleH = maxTextHeight / fontSize;
      fontSize = Math.floor(fontSize * Math.min(scaleW, scaleH));
      offCtx.font = `900 ${fontSize}px "Author", "Cabinet Grotesk", system-ui, sans-serif`;
    }

    offCtx.fillStyle = "#000000";
    offCtx.textAlign = "center";
    offCtx.textBaseline = "middle";
    offCtx.fillText("ANDREY", canvas.width / 2, canvas.height / 2);

    const imgData = offCtx.getImageData(0, 0, canvas.width, canvas.height).data;
    const step = Math.max(3, Math.round(2.8 * dpr));
    particleSize = Math.max(1.15, 1.3 * dpr);

    const coords: number[] = [];
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        if ((imgData[(y * canvas.width + x) * 4 + 3] ?? 0) > 120) coords.push(x, y);
      }
    }

    particleCount = Math.floor(coords.length / 2);
    particleData = new Float32Array(particleCount * 6);
    for (let i = 0; i < particleCount; i++) {
      const s = i * 6;
      const ox = coords[i * 2] ?? 0;
      const oy = coords[i * 2 + 1] ?? 0;
      particleData[s + 0] = ox + (Math.random() - 0.5) * 4;
      particleData[s + 1] = oy + (Math.random() - 0.5) * 4;
      particleData[s + 2] = ox;
      particleData[s + 3] = oy;
    }
    wake();
  }

  let lastTime = 0;
  function wake() {
    if (isVisible && !animId) {
      lastTime = 0;
      animId = requestAnimationFrame(render);
    }
  }

  function render(now: number) {
    if (!isVisible || !ctx) {
      animId = 0;
      lastTime = 0;
      return;
    }

    const dt = lastTime > 0 ? Math.min(Math.max((now - lastTime) / 16.666, 0.4), 1.6) : 1;
    lastTime = now;
    const spring = 0.065 * dt;
    const friction = 0.88 ** dt;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1c1917";
    ctx.beginPath();

    let maxDisplacement = 0;
    const mouseX = mouse.x * dpr;
    const mouseY = mouse.y * dpr;
    const mouseRadius = mouse.radius * dpr;
    const radiusSq = mouseRadius * mouseRadius;

    for (let i = 0; i < particleCount; i++) {
      const s = i * 6;
      let x = particleData[s + 0] ?? 0;
      let y = particleData[s + 1] ?? 0;
      const ox = particleData[s + 2] ?? 0;
      const oy = particleData[s + 3] ?? 0;
      let vx = particleData[s + 4] ?? 0;
      let vy = particleData[s + 5] ?? 0;

      const dx = mouseX - x;
      const dy = mouseY - y;
      const distSq = dx * dx + dy * dy;
      if (distSq < radiusSq && distSq > 0) {
        const dist = Math.sqrt(distSq);
        const force = (mouseRadius - dist) / mouseRadius;
        const push = ((force * force * 34 * dpr) / dist) * dt;
        vx -= dx * push;
        vy -= dy * push;
      }

      const dOx = ox - x;
      const dOy = oy - y;
      vx = (vx + dOx * spring) * friction;
      vy = (vy + dOy * spring) * friction;
      x += vx * dt;
      y += vy * dt;

      particleData[s + 0] = x;
      particleData[s + 1] = y;
      particleData[s + 4] = vx;
      particleData[s + 5] = vy;

      const disp = Math.abs(dOx) + Math.abs(dOy) + Math.abs(vx) + Math.abs(vy);
      if (disp > maxDisplacement) maxDisplacement = disp;
      ctx.rect(x, y, particleSize, particleSize);
    }
    ctx.fill();

    if (!mouse.isInteracting && maxDisplacement < 0.15 * dpr) {
      animId = 0;
      lastTime = 0;
      return;
    }
    animId = requestAnimationFrame(render);
  }

  const handlePointer = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.isInteracting = true;
    wake();
  };
  const handleLeave = () => {
    mouse.x = -9999;
    mouse.y = -9999;
    mouse.isInteracting = false;
  };

  canvas.addEventListener("pointermove", handlePointer, { passive: true });
  canvas.addEventListener("pointerleave", handleLeave, { passive: true });
  canvas.addEventListener("pointerdown", handlePointer, { passive: true });

  const resizeObserver = new ResizeObserver(() => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(createParticles, 120);
  });
  resizeObserver.observe(canvas);

  const io = new IntersectionObserver(
    (entries) => {
      const first = entries[0];
      if (first) {
        isVisible = first.isIntersecting;
        if (isVisible) wake();
        else if (animId) {
          cancelAnimationFrame(animId);
          animId = 0;
        }
      }
    },
    { threshold: 0.05 },
  );
  io.observe(canvas);

  if (document.fonts) document.fonts.ready.then(createParticles);
  else createParticles();

  return () => {
    if (animId) cancelAnimationFrame(animId);
    window.clearTimeout(resizeTimer);
    canvas.removeEventListener("pointermove", handlePointer);
    canvas.removeEventListener("pointerleave", handleLeave);
    canvas.removeEventListener("pointerdown", handlePointer);
    resizeObserver.disconnect();
    io.disconnect();
  };
}
