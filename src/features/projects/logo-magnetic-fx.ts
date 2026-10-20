import { gsap } from "gsap";
import { getAudioSystem } from "../../core/audio";

export interface LogoMagneticOptions {
  readonly trigger: HTMLElement;
  readonly target: HTMLElement;
  readonly strength?: number;
}

export class LogoMagneticController {
  private readonly trigger: HTMLElement;
  private readonly target: HTMLElement;
  private readonly strength: number;
  private readonly prefersReduced: boolean;
  private readonly audio = getAudioSystem();
  private isHovered = false;

  constructor(options: LogoMagneticOptions) {
    this.trigger = options.trigger;
    this.target = options.target;
    this.strength = options.strength ?? 0.38;
    this.prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.bindEvents(true);
  }

  private bindEvents(attach: boolean): void {
    const fn = attach ? "addEventListener" : "removeEventListener";
    this.trigger[fn]("pointermove", this.handlePointerMove as EventListener);
    this.trigger[fn]("pointerleave", this.handlePointerLeave as EventListener);
    this.trigger[fn]("pointerdown", this.handlePointerDown as EventListener);
    this.trigger[fn]("pointerup", this.handlePointerUp as EventListener);
    window[fn]("pointermove", this.handleWindowPointerMove as EventListener);
  }

  private readonly handleWindowPointerMove = (e: PointerEvent): void => {
    if (this.prefersReduced || e.pointerType !== "mouse") return;
    const rect = this.trigger.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
    if (dist <= 180) {
      this.audio.triggerProximityAura(1 - dist / 180);
    }
  };

  private readonly handlePointerMove = (e: PointerEvent): void => {
    if (this.prefersReduced || e.pointerType !== "mouse") return;
    this.isHovered = true;
    const rect = this.trigger.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const dist = Math.hypot(dx, dy);

    const stretchX = 1 + Math.min(dist * 0.005, 0.22);
    const stretchY = 1 - Math.min(dist * 0.004, 0.16);

    gsap.to(this.target, {
      x: dx * this.strength,
      y: dy * this.strength,
      rotation: dx * 0.22,
      scaleX: stretchX,
      scaleY: stretchY,
      duration: 0.24,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  private readonly handlePointerLeave = (): void => {
    if (!this.isHovered) return;
    this.isHovered = false;
    gsap.to(this.target, {
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      duration: 0.95,
      ease: "elastic.out(1.4, 0.28)",
      overwrite: "auto",
    });
  };

  private readonly handlePointerDown = (): void => {
    this.audio.playTactileFeedback("jelly_pop");
    gsap.to(this.target, {
      scaleX: 1.25,
      scaleY: 0.74,
      rotation: 0,
      duration: 0.12,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  private readonly handlePointerUp = (): void => {
    gsap.to(this.target, {
      scaleX: 1,
      scaleY: 1,
      duration: 0.75,
      ease: "elastic.out(1.5, 0.26)",
      overwrite: "auto",
    });
  };

  public destroy(): void {
    this.bindEvents(false);
    gsap.killTweensOf(this.target);
  }
}
