export interface SpringConfig {
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
}

export interface Spring2D {
  targetX: number;
  targetY: number;
  currentX: number;
  currentY: number;
  vx: number;
  vy: number;
  reset: (x: number, y: number) => void;
  step: (dt: number) => boolean;
}

export const DEFAULT_SPRING_CONFIG: SpringConfig = {
  stiffness: 340,
  damping: 18,
  mass: 0.35,
};

export interface VelocityDeformation {
  readonly angle: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

export const calculateVelocityDeformation = (
  vx: number,
  vy: number,
  lastAngle = 0,
): VelocityDeformation => {
  const speed = Math.hypot(vx, vy);
  if (speed < 12) {
    return { angle: lastAngle, scaleX: 1, scaleY: 1 };
  }
  const angle = (Math.atan2(vy, vx) * 180) / Math.PI;
  const stretch = Math.min(speed * 0.00028, 0.28);
  const scaleX = 1 + stretch;
  const scaleY = 1 / (1 + stretch * 0.75);
  return { angle, scaleX, scaleY };
};

export interface SpringStepResult {
  readonly isResting: boolean;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

export const stepCursorSpring = (
  spring: Spring2D,
  dt: number,
  canDeform: boolean,
  lastAngle = 0,
): SpringStepResult => {
  const isResting = spring.step(dt);
  if (!canDeform || isResting) {
    return {
      isResting,
      x: spring.currentX,
      y: spring.currentY,
      angle: 0,
      scaleX: 1,
      scaleY: 1,
    };
  }
  const def = calculateVelocityDeformation(spring.vx, spring.vy, lastAngle);
  return {
    isResting: false,
    x: spring.currentX,
    y: spring.currentY,
    angle: def.angle,
    scaleX: def.scaleX,
    scaleY: def.scaleY,
  };
};

export const createSpring2D = (config: SpringConfig = DEFAULT_SPRING_CONFIG): Spring2D => {
  const spring: Spring2D = {
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0,
    vx: 0,
    vy: 0,
    reset: (x: number, y: number) => {
      spring.targetX = x;
      spring.targetY = y;
      spring.currentX = x;
      spring.currentY = y;
      spring.vx = 0;
      spring.vy = 0;
    },
    step: (dt: number): boolean => {
      const subDt = dt * 0.5;
      for (let i = 0; i < 2; i++) {
        const dx = spring.targetX - spring.currentX;
        const dy = spring.targetY - spring.currentY;
        const ax = (dx * config.stiffness - config.damping * spring.vx) / config.mass;
        const ay = (dy * config.stiffness - config.damping * spring.vy) / config.mass;

        spring.vx += ax * subDt;
        spring.vy += ay * subDt;

        spring.currentX += spring.vx * subDt;
        spring.currentY += spring.vy * subDt;
      }

      const distSq =
        (spring.targetX - spring.currentX) ** 2 + (spring.targetY - spring.currentY) ** 2;
      const velSq = spring.vx ** 2 + spring.vy ** 2;
      const isResting = distSq < 0.001 && velSq < 0.01;

      if (isResting) {
        spring.currentX = spring.targetX;
        spring.currentY = spring.targetY;
        spring.vx = 0;
        spring.vy = 0;
        return true;
      }

      return false;
    },
  };

  return spring;
};
