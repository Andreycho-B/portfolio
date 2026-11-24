export class StudioPowerController {
  private poweredOn = false;
  private power = 0;
  private depression = 0.42;
  private prefersReducedMotion = false;
  private readonly motionQuery: MediaQueryList | null;

  constructor() {
    if (typeof window !== "undefined") {
      this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.prefersReducedMotion = this.motionQuery.matches;
      this.motionQuery.addEventListener("change", this.handleMotionChange);
    } else {
      this.motionQuery = null;
    }
  }

  public get isPoweredOn(): boolean {
    return this.poweredOn;
  }

  public get powerProgress(): number {
    return this.power;
  }

  public get buttonDepression(): number {
    return this.depression;
  }

  public getCursorLabel(): "Apagar" | "Encender" {
    return this.poweredOn ? "Apagar" : "Encender";
  }

  public toggle(): boolean {
    this.poweredOn = !this.poweredOn;
    this.depression = 1;
    if (this.prefersReducedMotion) {
      this.power = this.poweredOn ? 1 : 0;
      this.depression = this.poweredOn ? 0 : 0.42;
    }
    return this.poweredOn;
  }

  public update(dtSeconds: number): boolean {
    const targetPower = this.poweredOn ? 1 : 0;
    const targetDepress = this.poweredOn ? 0 : 0.42;

    if (this.prefersReducedMotion || dtSeconds <= 0) {
      this.power = targetPower;
      this.depression = targetDepress;
      return false;
    }

    const powerRate = this.poweredOn ? 5.2 : 8.5;
    this.power += (targetPower - this.power) * (1 - Math.exp(-powerRate * dtSeconds));
    if (Math.abs(targetPower - this.power) < 0.002) this.power = targetPower;

    this.depression += (targetDepress - this.depression) * (1 - Math.exp(-14 * dtSeconds));
    if (Math.abs(targetDepress - this.depression) < 0.002) this.depression = targetDepress;

    return this.power !== targetPower || this.depression !== targetDepress;
  }

  public dispose(): void {
    this.motionQuery?.removeEventListener("change", this.handleMotionChange);
  }

  private readonly handleMotionChange = (): void => {
    if (!this.motionQuery) return;
    this.prefersReducedMotion = this.motionQuery.matches;
    if (this.prefersReducedMotion) {
      this.power = this.poweredOn ? 1 : 0;
      this.depression = this.poweredOn ? 0 : 0.42;
    }
  };
}
