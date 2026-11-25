import Matter from "matter-js";

interface LogoBinding {
  readonly body: Matter.Body;
  readonly el: HTMLElement;
  readonly halfW: number;
  readonly halfH: number;
  active: boolean;
  spawnScale: number;
  lastX: number;
  lastY: number;
  lastAngle: number;
  lastScale: number;
}

export function createLogoBindings(logoElements: HTMLElement[], width: number): LogoBinding[] {
  const bindings: LogoBinding[] = [];
  logoElements.forEach((el, index) => {
    const shape = el.dataset.shape ?? "circle";
    const [w, h] = [el.offsetWidth || 76, el.offsetHeight || 76];
    const [halfW, halfH] = [w / 2, h / 2];
    const cols = Math.max(2, Math.floor(width / (w + 14)));
    const startX = (width / (cols + 1)) * ((index % cols) + 1) + (Math.random() - 0.5) * 36;
    const startY = 32 + (Math.random() - 0.5) * 20;
    const rad = shape === "squircle" ? 22 : shape === "pill" ? halfH : 18;
    const bOpt = { restitution: 0.38, friction: 0.2, frictionAir: 0.015 };
    const body =
      shape === "circle"
        ? Matter.Bodies.circle(startX, startY, halfW, bOpt)
        : Matter.Bodies.rectangle(startX, startY, w, h, { ...bOpt, chamfer: { radius: rad } });
    el.style.opacity = "0";
    bindings.push({
      body,
      el,
      halfW,
      halfH,
      active: false,
      spawnScale: 0.35,
      lastX: -1e9,
      lastY: -1e9,
      lastAngle: -1e9,
      lastScale: -1,
    });
  });
  return bindings;
}

export function applyCursorCollision(
  bindings: LogoBinding[],
  mouseX: number,
  mouseY: number,
  vx: number,
  vy: number,
  speed: number,
): void {
  const impactRadius = 68;
  const impactRadiusSq = impactRadius * impactRadius;

  for (let i = 0; i < bindings.length; i++) {
    const binding = bindings[i];
    if (!binding?.active) continue;
    const dx = binding.body.position.x - mouseX;
    const dy = binding.body.position.y - mouseY;
    const distSq = dx * dx + dy * dy;

    if (distSq < impactRadiusSq && distSq > 1) {
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const ny = dy / dist;
      Matter.Body.translate(binding.body, {
        x: nx * (impactRadius - dist) * 0.7,
        y: ny * (impactRadius - dist) * 0.7,
      });
      const f = Math.min(0.08, 0.02 + speed * 0.002);
      Matter.Body.applyForce(binding.body, binding.body.position, {
        x: (nx * 0.65 + (vx / (speed || 1)) * 0.35) * f,
        y: (ny * 0.65 + (vy / (speed || 1)) * 0.35) * f,
      });
    }
  }
}

export function syncLogoTransforms(bindings: LogoBinding[]): boolean {
  let anyActiveMotion = false;
  for (let i = 0; i < bindings.length; i++) {
    const binding = bindings[i];
    if (!binding?.active) continue;
    const { body, el, halfW, halfH, spawnScale } = binding;
    const tx = body.position.x - halfW;
    const ty = body.position.y - halfH;
    const ang = body.angle;
    if (
      Math.abs(tx - binding.lastX) > 0.02 ||
      Math.abs(ty - binding.lastY) > 0.02 ||
      Math.abs(ang - binding.lastAngle) > 0.0002 ||
      Math.abs(spawnScale - binding.lastScale) > 0.002
    ) {
      binding.lastX = tx;
      binding.lastY = ty;
      binding.lastAngle = ang;
      binding.lastScale = spawnScale;
      const scSuffix = Math.abs(spawnScale - 1) > 0.002 ? ` scale(${spawnScale.toFixed(3)})` : "";
      el.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) rotate(${ang.toFixed(4)}rad)${scSuffix}`;
      anyActiveMotion = true;
    } else if (body.speed > 0.02 || body.angularSpeed > 0.002) {
      anyActiveMotion = true;
    }
  }
  return anyActiveMotion;
}
