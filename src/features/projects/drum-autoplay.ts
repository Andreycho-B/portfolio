export interface DrumAutoplayOptions {
  readonly onWake: () => void;
  readonly baseSpeedSlotsPerSec?: number;
  readonly resumeDelayMs?: number;
}

export class DrumAutoplayController {
  private readonly onWake: () => void;
  private readonly baseSpeed: number;
  private readonly resumeDelayMs: number;
  private prefersReducedMotion = false;
  private isInteractingFlag = false;
  private idleTimer: number | null = null;
  private currentBlend = 1;
  private direction: 1 | -1 = 1;
  private readonly motionQuery: MediaQueryList | null;

  constructor(options: DrumAutoplayOptions) {
    this.onWake = options.onWake;
    this.baseSpeed = options.baseSpeedSlotsPerSec ?? 0.11;
    this.resumeDelayMs = options.resumeDelayMs ?? 1200;

    if (typeof window !== "undefined") {
      this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.prefersReducedMotion = this.motionQuery.matches;
      this.motionQuery.addEventListener("change", this.handleMotionChange);
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
    } else {
      this.motionQuery = null;
    }
  }

  public notifyUserInteraction(direction?: number): void {
    if (direction !== undefined && direction !== 0) {
      this.direction = direction > 0 ? 1 : -1;
    }
    this.isInteractingFlag = true;
    this.currentBlend = 0;
    if (this.idleTimer !== null) {
      window.clearTimeout(this.idleTimer);
    }
    this.idleTimer = window.setTimeout(() => {
      this.idleTimer = null;
      this.isInteractingFlag = false;
      this.onWake();
    }, this.resumeDelayMs);
  }

  public setDirection(direction: 1 | -1): void {
    this.direction = direction;
  }

  public isUserInteracting(): boolean {
    return this.isInteractingFlag;
  }

  public isDrifting(): boolean {
    return !this.prefersReducedMotion && !this.isInteractingFlag && this.currentBlend > 0.001;
  }

  public update(deltaSeconds: number, isHovering: boolean): number {
    if (this.prefersReducedMotion || typeof document === "undefined" || document.hidden) {
      return 0;
    }

    const targetBlend = this.isInteractingFlag || isHovering ? 0 : 1;
    const blendRate = targetBlend > this.currentBlend ? 1.4 : 3.2;
    this.currentBlend +=
      (targetBlend - this.currentBlend) * (1 - Math.exp(-blendRate * deltaSeconds));

    if (this.currentBlend < 0.0005) {
      this.currentBlend = 0;
      return 0;
    }

    return this.direction * this.baseSpeed * this.currentBlend * deltaSeconds;
  }

  public dispose(): void {
    if (this.idleTimer !== null) {
      window.clearTimeout(this.idleTimer);
    }
    this.motionQuery?.removeEventListener("change", this.handleMotionChange);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    }
  }

  private readonly handleMotionChange = (): void => {
    if (this.motionQuery) {
      this.prefersReducedMotion = this.motionQuery.matches;
      if (this.prefersReducedMotion) {
        this.currentBlend = 0;
      }
    }
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.currentBlend = 0;
    } else if (!this.isInteractingFlag) {
      this.onWake();
    }
  };
}
