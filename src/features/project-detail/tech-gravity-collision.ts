import Matter from "matter-js";

export interface LogoBinding {
  readonly body: Matter.Body;
  readonly el: HTMLElement;
  readonly halfW: number;
  readonly halfH: number;
  active: boolean;
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
    const item = bindings[i];
    if (!item?.active) continue;
    const dx = item.body.position.x - mouseX;
    const dy = item.body.position.y - mouseY;
    const distSq = dx * dx + dy * dy;

    if (distSq < impactRadiusSq && distSq > 1) {
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const ny = dy / dist;
      Matter.Body.translate(item.body, {
        x: nx * (impactRadius - dist) * 0.7,
        y: ny * (impactRadius - dist) * 0.7,
      });
      const f = Math.min(0.08, 0.02 + speed * 0.002);
      Matter.Body.applyForce(item.body, item.body.position, {
        x: (nx * 0.65 + (vx / (speed || 1)) * 0.35) * f,
        y: (ny * 0.65 + (vy / (speed || 1)) * 0.35) * f,
      });
    }
  }
}
