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

// Parámetros idénticos a Motion-Primitives / Framer Motion useSpring({ bounce: 0.001 })
export const DEFAULT_SPRING_CONFIG: SpringConfig = {
  stiffness: 350,
  damping: 28,
  mass: 0.5,
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
      // Sub-stepping simétrico para máxima estabilidad matemática e inmunidad a fluctuaciones de refresco
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

export interface Spring1D {
  target: number;
  current: number;
  velocity: number;
  reset: (val: number) => void;
  step: (dt: number) => boolean;
}

export const createSpring1D = (config: SpringConfig = DEFAULT_SPRING_CONFIG): Spring1D => {
  const spring: Spring1D = {
    target: 0,
    current: 0,
    velocity: 0,
    reset: (val: number) => {
      spring.target = val;
      spring.current = val;
      spring.velocity = 0;
    },
    step: (dt: number): boolean => {
      const subDt = dt * 0.5;
      for (let i = 0; i < 2; i++) {
        const delta = spring.target - spring.current;
        const acceleration =
          (delta * config.stiffness - config.damping * spring.velocity) / config.mass;
        spring.velocity += acceleration * subDt;
        spring.current += spring.velocity * subDt;
      }

      const isResting =
        Math.abs(spring.target - spring.current) < 0.03 && Math.abs(spring.velocity) < 0.1;
      if (isResting) {
        spring.current = spring.target;
        spring.velocity = 0;
        return true;
      }
      return false;
    },
  };

  return spring;
};
